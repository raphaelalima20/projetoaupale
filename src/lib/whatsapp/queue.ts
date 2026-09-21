/**
 * WhatsApp queue logic. SERVER-ONLY: takes a service-role Supabase client and reads
 * whatsapp_config (which holds the provider token and is unreachable from the browser).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  WhatsappConfig,
  WhatsappMessageType,
  WhatsappQueueMessage,
  WhatsappTemplate,
} from "@/lib/types/database";
import { sendText, type ProviderConfig } from "./providers";
import { firstName, renderTemplate, toWhatsappNumber, type TemplateVars } from "./render";
import {
  addDaysISO,
  brtInstant,
  formatDateBR,
  formatHourMinute,
  isLeapYear,
  todayBRT,
} from "@/lib/timezone";

export const MAX_ATTEMPTS = 3;
/** Reminders go out the morning before the appointment, when the daily cron runs (08:00 BRT). */
const REMINDER_HOUR = "08:00";
const RETRY_DELAY_MS = 15 * 60 * 1000;

export interface AppointmentForMessage {
  id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string;
  service_name: string;
  appointment_date: string;
  appointment_time: string;
}

interface Templates {
  [tipo: string]: WhatsappTemplate | undefined;
}

export async function loadConfig(admin: SupabaseClient): Promise<WhatsappConfig | null> {
  const { data } = await admin.from("whatsapp_config").select("*").maybeSingle();
  return (data as WhatsappConfig | null) ?? null;
}

async function loadTemplates(admin: SupabaseClient): Promise<Templates> {
  const { data } = await admin.from("whatsapp_templates").select("*");
  const map: Templates = {};
  for (const t of (data as WhatsappTemplate[]) ?? []) map[t.tipo] = t;
  return map;
}

/** Only pending sends are considered while WhatsApp is switched on. */
export function isReady(config: WhatsappConfig | null): config is WhatsappConfig {
  return !!config && config.ativo && !!config.url_api && !!config.token_api && !!config.instancia;
}

function toProviderConfig(config: WhatsappConfig): ProviderConfig {
  return {
    provider: config.provider,
    url_api: config.url_api,
    token_api: config.token_api,
    instancia: config.instancia,
  };
}

async function insertMessages(
  admin: SupabaseClient,
  rows: {
    cliente_id: string | null;
    agendamento_id: string | null;
    tipo: WhatsappMessageType;
    mensagem: string;
    telefone: string;
    agendado_para: string;
    chave_unica: string;
  }[]
): Promise<number> {
  if (rows.length === 0) return 0;
  // ignoreDuplicates makes every enqueue idempotent through chave_unica.
  const { data, error } = await admin
    .from("whatsapp_mensagens_fila")
    .upsert(rows, { onConflict: "chave_unica", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

function appointmentVars(appt: AppointmentForMessage, professional: string): TemplateVars {
  return {
    nome: firstName(appt.client_name),
    servico: appt.service_name,
    profissional: professional,
    data: formatDateBR(appt.appointment_date),
    hora: formatHourMinute(appt.appointment_time),
  };
}

/**
 * Called right after an appointment is created: queues the confirmation (immediately) and the
 * reminder for the day before — each only if WhatsApp is on and that message type is enabled.
 */
export async function enqueueAppointmentMessages(
  admin: SupabaseClient,
  appt: AppointmentForMessage,
  professionalName: string
): Promise<void> {
  const config = await loadConfig(admin);
  if (!config?.ativo) return;

  const templates = await loadTemplates(admin);
  const phone = toWhatsappNumber(appt.client_phone);
  const vars = appointmentVars(appt, professionalName);
  const rows: Parameters<typeof insertMessages>[1] = [];

  const confirmation = templates.confirmacao;
  if (confirmation?.ativo) {
    rows.push({
      cliente_id: appt.client_id,
      agendamento_id: appt.id,
      tipo: "confirmacao",
      mensagem: renderTemplate(confirmation.mensagem_template, vars),
      telefone: phone,
      agendado_para: new Date().toISOString(),
      chave_unica: `confirmacao:${appt.id}`,
    });
  }

  const reminder = templates.lembrete;
  const today = todayBRT();
  // "1 dia antes": nothing to remind if the appointment is today; if the morning-before slot has
  // already passed (booked yesterday evening for tomorrow) it simply goes out on the next run.
  if (reminder?.ativo && appt.appointment_date > today) {
    const dayBefore = addDaysISO(appt.appointment_date, -1);
    const when = brtInstant(dayBefore, REMINDER_HOUR);
    rows.push({
      cliente_id: appt.client_id,
      agendamento_id: appt.id,
      tipo: "lembrete",
      mensagem: renderTemplate(reminder.mensagem_template, vars),
      telefone: phone,
      agendado_para: (when.getTime() < Date.now() ? new Date() : when).toISOString(),
      chave_unica: `lembrete:${appt.id}`,
    });
  }

  await insertMessages(admin, rows);
}

/** Safety net for the daily cron: reminders for tomorrow's appointments that don't have one yet. */
export async function queueTomorrowReminders(admin: SupabaseClient): Promise<{ criados: number; encontrados: number }> {
  const config = await loadConfig(admin);
  if (!config?.ativo) return { criados: 0, encontrados: 0 };
  const templates = await loadTemplates(admin);
  const reminder = templates.lembrete;
  if (!reminder?.ativo) return { criados: 0, encontrados: 0 };

  const tomorrow = addDaysISO(todayBRT(), 1);
  const { data: appts, error } = await admin
    .from("appointments")
    .select("id, client_id, client_name, client_phone, service_name, appointment_date, appointment_time, collaborator_id")
    .eq("appointment_date", tomorrow)
    .eq("status", "agendado");
  if (error) throw new Error(error.message);
  const list = (appts ?? []) as (AppointmentForMessage & { collaborator_id: string | null })[];
  if (list.length === 0) return { criados: 0, encontrados: 0 };

  const collabIds = Array.from(new Set(list.map((a) => a.collaborator_id).filter((id): id is string => !!id)));
  const { data: profiles } = collabIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", collabIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));

  const rows = list.map((a) => ({
    cliente_id: a.client_id,
    agendamento_id: a.id,
    tipo: "lembrete" as const,
    mensagem: renderTemplate(
      reminder.mensagem_template,
      appointmentVars(a, (a.collaborator_id && nameById.get(a.collaborator_id)) || "")
    ),
    telefone: toWhatsappNumber(a.client_phone),
    agendado_para: new Date().toISOString(),
    chave_unica: `lembrete:${a.id}`,
  }));

  return { criados: await insertMessages(admin, rows), encontrados: list.length };
}

/** Birthday messages for today's birthdays (Feb 29 is celebrated on Feb 28 in common years). */
export async function queueBirthdays(admin: SupabaseClient): Promise<{ criados: number; encontrados: number }> {
  const config = await loadConfig(admin);
  if (!config?.ativo) return { criados: 0, encontrados: 0 };
  const templates = await loadTemplates(admin);
  const birthday = templates.aniversario;
  if (!birthday?.ativo) return { criados: 0, encontrados: 0 };

  const today = todayBRT();
  const [year, month, day] = today.split("-").map(Number);
  const includeFeb29 = month === 2 && day === 28 && !isLeapYear(year);

  const { data, error } = await admin.rpc("birthday_clients", {
    p_month: month,
    p_day: day,
    p_include_feb29: includeFeb29,
  });
  if (error) throw new Error(error.message);
  const clients = (data ?? []) as { id: string; name: string; phone: string }[];

  const rows = clients.map((c) => ({
    cliente_id: c.id,
    agendamento_id: null,
    tipo: "aniversario" as const,
    mensagem: renderTemplate(birthday.mensagem_template, { nome: firstName(c.name) }),
    telefone: toWhatsappNumber(c.phone),
    agendado_para: new Date().toISOString(),
    chave_unica: `aniversario:${c.id}:${year}`,
  }));

  return { criados: await insertMessages(admin, rows), encontrados: clients.length };
}

/** Sends one already-claimed message and records the outcome (the queue doubles as the audit log). */
async function deliver(
  admin: SupabaseClient,
  config: WhatsappConfig,
  msg: WhatsappQueueMessage
): Promise<"enviado" | "erro" | "reagendado"> {
  const result = await sendText(toProviderConfig(config), msg.telefone, msg.mensagem);

  if (result.ok) {
    await admin
      .from("whatsapp_mensagens_fila")
      .update({ status: "enviado", enviado_em: new Date().toISOString(), erro_msg: null })
      .eq("id", msg.id);
    return "enviado";
  }

  const giveUp = msg.tentativas >= MAX_ATTEMPTS;
  await admin
    .from("whatsapp_mensagens_fila")
    .update({
      status: giveUp ? "erro" : "pendente",
      erro_msg: result.error ?? "Falha desconhecida.",
      agendado_para: giveUp ? msg.agendado_para : new Date(Date.now() + RETRY_DELAY_MS).toISOString(),
    })
    .eq("id", msg.id);
  return giveUp ? "erro" : "reagendado";
}

export interface ProcessSummary {
  ativo: boolean;
  processadas: number;
  enviadas: number;
  erros: number;
  reagendadas: number;
}

/** Claims due messages atomically (safe against concurrent runs) and sends them. */
export async function processQueue(admin: SupabaseClient, limit = 25): Promise<ProcessSummary> {
  const config = await loadConfig(admin);
  const summary: ProcessSummary = { ativo: isReady(config), processadas: 0, enviadas: 0, erros: 0, reagendadas: 0 };
  if (!isReady(config)) return summary;

  const { data, error } = await admin.rpc("claim_whatsapp_messages", { p_limit: limit });
  if (error) throw new Error(error.message);

  for (const msg of (data ?? []) as WhatsappQueueMessage[]) {
    const outcome = await deliver(admin, config, msg);
    summary.processadas++;
    if (outcome === "enviado") summary.enviadas++;
    else if (outcome === "erro") summary.erros++;
    else summary.reagendadas++;
  }
  return summary;
}

/** Re-queues a failed message and sends it right away (admin "Reenviar" button). */
export async function resendMessage(admin: SupabaseClient, id: string): Promise<{ ok: boolean; error?: string }> {
  const config = await loadConfig(admin);
  if (!isReady(config)) return { ok: false, error: "WhatsApp está desativado ou incompleto nas configurações." };

  const { data: row } = await admin.from("whatsapp_mensagens_fila").select("*").eq("id", id).maybeSingle();
  const msg = row as WhatsappQueueMessage | null;
  if (!msg) return { ok: false, error: "Mensagem não encontrada." };
  if (msg.status === "enviado") return { ok: false, error: "Esta mensagem já foi enviada." };

  await admin
    .from("whatsapp_mensagens_fila")
    .update({ status: "enviando", tentativas: 0, reivindicada_em: new Date().toISOString() })
    .eq("id", id);
  const outcome = await deliver(admin, config, { ...msg, tentativas: MAX_ATTEMPTS });
  if (outcome === "enviado") return { ok: true };
  const { data: after } = await admin.from("whatsapp_mensagens_fila").select("erro_msg").eq("id", id).maybeSingle();
  return { ok: false, error: (after as { erro_msg: string | null } | null)?.erro_msg ?? "Falha no envio." };
}

/** Ad-hoc message (e.g. a manual test): logged in the queue like any other, then sent immediately. */
export async function sendNow(
  admin: SupabaseClient,
  input: { telefone: string; mensagem: string; tipo: WhatsappMessageType; clienteId?: string | null }
): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { data, error } = await admin
    .from("whatsapp_mensagens_fila")
    .insert({
      cliente_id: input.clienteId ?? null,
      tipo: input.tipo,
      mensagem: input.mensagem,
      telefone: toWhatsappNumber(input.telefone),
      status: "pendente",
      agendado_para: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Não foi possível registrar a mensagem." };
  const result = await resendMessage(admin, data.id as string);
  return { ...result, id: data.id as string };
}
