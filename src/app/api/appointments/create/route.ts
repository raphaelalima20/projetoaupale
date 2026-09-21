import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCaller } from "@/lib/api-auth";
import { getBlockForDate, isHourBlocked } from "@/lib/scheduleBlocks";
import { enqueueAppointmentMessages, processQueue } from "@/lib/whatsapp/queue";
import { addDaysISO, hourBRT, todayBRT } from "@/lib/timezone";
import type { ScheduleBlock } from "@/lib/types/database";

/** How far ahead a visitor (no login) may book. Staff have no limit. */
const PUBLIC_MAX_DAYS_AHEAD = 90;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Single entry point for creating appointments, for both the public booking flow (no login,
 * origin "app") and staff booking from the agenda (origin "manual"). Doing it server-side means
 * the origin can't be spoofed, the price always comes from the catalog, availability is enforced,
 * and the WhatsApp confirmation/reminder are queued in the same step.
 *
 * The client (name + phone) is registered automatically by a database trigger.
 */
export async function POST(request: Request) {
  const caller = await resolveCaller(request);
  const isStaff = caller.kind === "admin" || caller.kind === "collaborator";
  const body = await request.json().catch(() => null);
  if (!body) return fail("Dados inválidos.");

  // ---- Basic field validation ----------------------------------------------------------
  const clientName = String(body.clientName ?? "").trim();
  if (clientName.length < 2 || clientName.length > 120) return fail("Informe o nome completo.");
  const clientPhone = String(body.clientPhone ?? "").replace(/\D/g, "");
  if (!/^\d{10,11}$/.test(clientPhone)) return fail("Informe um telefone válido.");

  const dateISO = String(body.dateISO ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || Number.isNaN(Date.parse(`${dateISO}T12:00:00Z`))) {
    return fail("Data inválida.");
  }
  const time = String(body.time ?? "").slice(0, 5);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return fail("Horário inválido.");
  const collaboratorId = String(body.collaboratorId ?? "");
  if (!collaboratorId) return fail("Selecione uma profissional.");

  const admin = createAdminClient();

  // ---- Salon rules -----------------------------------------------------------------------
  const { data: settings } = await admin
    .from("salon_settings")
    .select("opening_time, closing_time, working_days")
    .maybeSingle();
  const opening = (settings?.opening_time ?? "08:00").slice(0, 5);
  const closing = (settings?.closing_time ?? "19:00").slice(0, 5);
  const workingDays: number[] = settings?.working_days ?? [1, 2, 3, 4, 5, 6];

  const today = todayBRT();
  if (dateISO < today) return fail("Não é possível agendar em uma data passada.");
  if (!isStaff && dateISO > addDaysISO(today, PUBLIC_MAX_DAYS_AHEAD)) {
    return fail("Essa data ainda não está disponível para agendamento.");
  }
  const weekday = new Date(`${dateISO}T12:00:00Z`).getUTCDay();
  if (!workingDays.includes(weekday)) return fail("O salão não funciona neste dia.");
  if (time < opening || time > closing) return fail(`Horário deve ser entre ${opening} e ${closing}.`);
  const hour = Number(time.slice(0, 2));
  if (!isStaff && dateISO === today && hour <= hourBRT()) return fail("Esse horário já passou.");

  // ---- Professional ------------------------------------------------------------------------
  const { data: collaborator } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("id", collaboratorId)
    .eq("role", "collaborator")
    .eq("is_active", true)
    .maybeSingle();
  if (!collaborator) return fail("Profissional inválida.");

  // ---- Service or package session -----------------------------------------------------------
  let serviceRow: { id: string; name: string; price: number; is_variable_price: boolean } | null = null;
  let packageRow: { id: string; package_name: string } | null = null;

  if (body.packageId) {
    const { data: pkg } = await admin
      .from("client_packages")
      .select("id, package_name, client_phone, status, total_sessions, used_sessions")
      .eq("id", String(body.packageId))
      .maybeSingle();
    if (!pkg || pkg.status !== "ativo" || pkg.client_phone !== clientPhone) {
      return fail("Pacote inválido para este telefone.");
    }
    // Sessions already booked but not yet concluded also count, so a package can't be over-booked.
    const { count: reserved } = await admin
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("package_id", pkg.id)
      .eq("status", "agendado");
    if (pkg.used_sessions + (reserved ?? 0) >= pkg.total_sessions) {
      return fail("Este pacote não tem sessões disponíveis.");
    }
    packageRow = { id: pkg.id, package_name: pkg.package_name };
  } else {
    const { data: service } = await admin
      .from("services")
      .select("id, name, price, is_variable_price, is_active")
      .eq("id", String(body.serviceId ?? ""))
      .maybeSingle();
    if (!service || !service.is_active) return fail("Serviço inválido.");
    serviceRow = service;
  }

  // ---- Availability ---------------------------------------------------------------------------
  const { data: blockRows } = await admin
    .from("schedule_blocks")
    .select("*")
    .eq("collaborator_id", collaboratorId)
    .lte("start_date", dateISO)
    .gte("end_date", dateISO);
  const block = getBlockForDate((blockRows ?? []) as ScheduleBlock[], collaboratorId, dateISO);
  if (isHourBlocked(block, hour, dateISO)) return fail(`${collaborator.full_name} está indisponível neste horário.`);

  const { data: taken } = await admin
    .from("appointments")
    .select("appointment_time")
    .eq("collaborator_id", collaboratorId)
    .eq("appointment_date", dateISO)
    .neq("status", "cancelado");
  const busy = (taken ?? []).some((a: { appointment_time: string }) =>
    // Visitors pick whole hours (the grid cell), so any booking inside that hour occupies it.
    // Staff may still add an off-the-hour booking next to an existing one, as in the agenda grid.
    isStaff ? a.appointment_time.slice(0, 5) === time : Number(a.appointment_time.slice(0, 2)) === hour
  );
  if (busy) return fail("Este horário acabou de ser ocupado. Escolha outro horário.", 409);

  // ---- Persist -------------------------------------------------------------------------------------
  const staffPrice = Number(body.servicePriceOverride);
  const price =
    serviceRow && isStaff && serviceRow.is_variable_price && Number.isFinite(staffPrice) && staffPrice >= 0
      ? staffPrice
      : serviceRow?.price ?? 0;

  const { data: created, error } = await admin
    .from("appointments")
    .insert({
      client_name: clientName,
      client_phone: clientPhone,
      collaborator_id: collaboratorId,
      service_id: serviceRow?.id ?? null,
      service_name: packageRow ? packageRow.package_name : serviceRow!.name,
      service_price: packageRow ? 0 : price,
      commission_value: 0,
      is_package_session: !!packageRow,
      package_id: packageRow?.id ?? null,
      package_session_value: null,
      appointment_date: dateISO,
      appointment_time: time,
      status: "agendado",
      origin: isStaff ? "manual" : "app",
      notes: isStaff ? String(body.notes ?? "").trim().slice(0, 500) || null : null,
      created_by: isStaff ? caller.userId : null,
    })
    .select("id, client_id, client_name, client_phone, service_name, appointment_date, appointment_time")
    .single();

  if (error || !created) {
    if (error?.code === "23505") return fail("Este horário acabou de ser ocupado. Escolha outro horário.", 409);
    return fail(error?.message ?? "Não foi possível criar o agendamento.", 500);
  }

  // ---- WhatsApp (best effort: a messaging failure must never undo a valid booking) ------------
  try {
    await enqueueAppointmentMessages(admin, created, collaborator.full_name);
    await processQueue(admin, 5);
  } catch (e) {
    console.error("[whatsapp] falha ao enfileirar/enviar após agendamento:", (e as Error).message);
  }

  return NextResponse.json({ id: created.id });
}
