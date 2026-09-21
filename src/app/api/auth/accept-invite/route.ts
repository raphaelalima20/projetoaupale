import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Checks whether an invite token is still valid, without consuming it. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, invite_accepted")
    .eq("invite_token", token)
    .maybeSingle();

  if (!profile || profile.invite_accepted) {
    return NextResponse.json({ valid: false });
  }

  return NextResponse.json({ valid: true, fullName: profile.full_name });
}

/**
 * Sets the collaborator's password and marks the invite as accepted.
 * The token is only ever consumed by this explicit form submission — never by a bare
 * link visit — so link-preview bots (WhatsApp/Slack/email safe-links) can't burn it.
 */
export async function POST(request: Request) {
  const { token, password } = await request.json();

  if (!token || !password) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: profile, error: findError } = await admin
    .from("profiles")
    .select("id, email, invite_accepted")
    .eq("invite_token", token)
    .maybeSingle();

  if (findError || !profile) {
    return NextResponse.json({ error: "Convite inválido ou expirado." }, { status: 404 });
  }
  if (profile.invite_accepted) {
    return NextResponse.json({ error: "Este convite já foi utilizado." }, { status: 400 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
    password,
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await admin
    .from("profiles")
    .update({ invite_accepted: true, invite_token: null })
    .eq("id", profile.id);

  return NextResponse.json({ success: true, email: profile.email });
}
