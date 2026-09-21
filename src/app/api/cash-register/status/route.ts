import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Lightweight, role-agnostic check for whether a cash register is currently open.
 * Collaborators have no direct RLS access to cash_register, but still need to know
 * whether they're allowed to conclude an appointment — this proxies that single fact.
 */
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: register } = await admin
    .from("cash_register")
    .select("id")
    .eq("status", "aberto")
    .maybeSingle();

  return NextResponse.json({ registerId: register?.id ?? null });
}
