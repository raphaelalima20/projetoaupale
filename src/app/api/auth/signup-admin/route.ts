import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { fullName, email, password } = await request.json();

  if (!fullName || !email || !password) {
    return NextResponse.json({ error: "Preencha todos os campos." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter pelo menos 6 caracteres." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { count, error: countError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  if (count && count > 0) {
    return NextResponse.json(
      { error: "Já existe uma conta administradora criada. Faça login normalmente." },
      { status: 403 }
    );
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Não foi possível criar a conta." },
      { status: 400 }
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    full_name: fullName,
    email,
    role: "admin",
    is_active: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
