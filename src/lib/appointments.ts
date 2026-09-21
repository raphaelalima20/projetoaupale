import type { Profile, Service } from "./types/database";

export interface PackageSessionInput {
  packageId: string;
  packageName: string;
}

export interface NewAppointmentInput {
  clientName: string;
  clientPhone: string;
  /** Either a regular service, or a package session (mutually exclusive). */
  service?: Service | null;
  /** Overrides `service.price` for variable-price services (e.g. adjusted for hair length). Staff only. */
  servicePriceOverride?: number | null;
  packageSession?: PackageSessionInput | null;
  collaborator: Pick<Profile, "id">;
  dateISO: string;
  time: string;
  notes?: string | null;
}

/**
 * Creates an appointment through `/api/appointments/create`.
 *
 * The server decides the origin ("manual" when a staff member is logged in, "app" for visitors),
 * takes the price from the catalog, checks availability and queues the WhatsApp messages. The
 * customer is registered automatically (name + phone) by a database trigger.
 *
 * Returns `{ error }` shaped like a Supabase result so call sites read `error.message`.
 */
export async function createAppointment(
  input: NewAppointmentInput
): Promise<{ error: { message: string } | null; id?: string }> {
  try {
    const res = await fetch("/api/appointments/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: input.clientName,
        clientPhone: input.clientPhone,
        serviceId: input.packageSession ? null : (input.service?.id ?? null),
        servicePriceOverride: input.servicePriceOverride ?? null,
        packageId: input.packageSession?.packageId ?? null,
        collaboratorId: input.collaborator.id,
        dateISO: input.dateISO,
        time: input.time,
        notes: input.notes ?? null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: { message: body.error ?? "Não foi possível criar o agendamento." } };
    }
    return { error: null, id: body.id };
  } catch {
    return { error: { message: "Sem conexão. Verifique sua internet e tente novamente." } };
  }
}
