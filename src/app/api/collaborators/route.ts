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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradoras podem cadastrar colaboradoras." },
      { status: 403 }
    );
  }

  const {
    fullName,
    email,
    phone,
    cpf,
    address,
    specialty,
    avatarColor,
    commissionPercentage,
    commissionChemicalPercentage,
  } = await request.json();

  const clampPct = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  };

  if (!fullName || !email) {
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios." }, { status: 400 });
  }
  if (!specialty || !String(specialty).trim()) {
    return NextResponse.json({ error: "Informe a especialidade." }, { status: 400 });
  }

  const admin = createAdminClient();
  const origin = new URL(request.url).origin;

  // Created with an unguessable throwaway password — the collaborator never sees it,
  // they set their own via the invite_token flow below before ever signing in.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: `${randomUUID()}${randomUUID()}`,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Não foi possível criar a conta." },
      { status: 400 }
    );
  }

  const inviteToken = randomUUID();

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    email,
    phone: phone || null,
    cpf: cpf || null,
    address: address || null,
    specialty: String(specialty).trim(),
    role: "collaborator",
    // Individual rates: "normal" for regular services, "químico" for services tagged as chemical.
    // They pre-fill (admin) or fully determine (collaborator) the commission when concluding.
    commission_percentage: clampPct(commissionPercentage),
    commission_chemical_percentage: clampPct(commissionChemicalPercentage),
    avatar_color: avatarColor || null,
    is_active: true,
    invite_token: inviteToken,
    invite_accepted: false,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({
    id: created.user.id,
    inviteLink: `${origin}/auth/invite?token=${inviteToken}`,
  });
}
