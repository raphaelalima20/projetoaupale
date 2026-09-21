import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivePackage, ClientPackage } from "./types/database";

export const PACKAGE_STATUS_LABELS: Record<string, string> = {
  ativo: "Ativo",
  concluido: "Concluído",
  expirado: "Expirado",
};

export function packageStatusTone(status: string): "success" | "gold" | "danger" | "neutral" {
  if (status === "ativo") return "success";
  if (status === "concluido") return "gold";
  if (status === "expirado") return "danger";
  return "neutral";
}

export function packageSessionsRemaining(pkg: Pick<ClientPackage, "total_sessions" | "used_sessions">): number {
  return Math.max(0, pkg.total_sessions - pkg.used_sessions);
}

/**
 * Active packages purchased for a given phone number. Goes through the `find_active_packages`
 * RPC so it also works for visitors without login, returning only what the booking form needs.
 */
export async function findActivePackagesForPhone(
  supabase: SupabaseClient,
  phoneDigits: string
): Promise<ActivePackage[]> {
  if (phoneDigits.length < 10) return [];
  const { data } = await supabase.rpc("find_active_packages", { p_phone: phoneDigits });
  return (data as ActivePackage[]) ?? [];
}

/** Finds an existing client by phone, or creates one — used when selling a package or booking a session. */
export async function upsertClientByPhone(
  supabase: SupabaseClient,
  name: string,
  phoneDigits: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("clients")
    .select("id")
    .eq("phone", phoneDigits)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created } = await supabase
    .from("clients")
    .insert({ name: name.trim(), phone: phoneDigits })
    .select("id")
    .single();
  return (created?.id as string) ?? null;
}
