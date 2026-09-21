import { timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Caller =
  | { kind: "cron" }
  | { kind: "admin"; userId: string }
  | { kind: "collaborator"; userId: string }
  | { kind: "anonymous" };

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; the same header works for manual triggers. */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && safeEqual(header.slice(7), secret);
}

/** Resolves who is calling: the cron secret, a logged-in admin/collaborator, or nobody. */
export async function resolveCaller(request: Request): Promise<Caller> {
  if (isCronRequest(request)) return { kind: "cron" };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "anonymous" };

  // Role comes from the DB with the service role — never from anything the client can influence.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) return { kind: "anonymous" };
  if (profile.role === "admin") return { kind: "admin", userId: user.id };
  if (profile.role === "collaborator") return { kind: "collaborator", userId: user.id };
  return { kind: "anonymous" };
}

export function canRunAutomation(caller: Caller): boolean {
  return caller.kind === "cron" || caller.kind === "admin";
}
