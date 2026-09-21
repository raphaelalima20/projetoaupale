import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: requesterProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (requesterProfile?.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradoras podem reenviar convites." },
      { status: 403 }
    );
  }

  const { collaboratorId } = await request.json();
  if (!collaboratorId) {
    return NextResponse.json({ error: "Colaboradora não informada." }, { status: 400 });
  }

  const admin = createAdminClient();
  const origin = new URL(request.url).origin;
  const inviteToken = randomUUID();

  const { error: updateError } = await admin
    .from("profiles")
    .update({ invite_token: inviteToken, invite_accepted: false })
    .eq("id", collaboratorId)
    .eq("role", "collaborator");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ inviteLink: `${origin}/auth/invite?token=${inviteToken}` });
}
