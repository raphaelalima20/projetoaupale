import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toISODate } from "@/lib/schedule";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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
      { error: "Apenas administradoras podem excluir colaboradoras." },
      { status: 403 }
    );
  }

  const { id } = params;
  if (id === user.id) {
    return NextResponse.json(
      { error: "Você não pode excluir sua própria conta." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("id, role").eq("id", id).single();
  if (!target) {
    return NextResponse.json({ error: "Colaboradora não encontrada." }, { status: 404 });
  }
  if (target.role !== "collaborator") {
    return NextResponse.json(
      { error: "Contas de administradora não podem ser excluídas por aqui." },
      { status: 400 }
    );
  }

  const today = toISODate(new Date());

  const { count: pendingAppointments } = await admin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("collaborator_id", id)
    .eq("status", "agendado")
    .gte("appointment_date", today);

  if ((pendingAppointments ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Esta colaboradora tem agendamentos futuros pendentes. Cancele-os antes de excluir.",
      },
      { status: 400 }
    );
  }

  const { count: openCommissions } = await admin
    .from("commissions")
    .select("id", { count: "exact", head: true })
    .eq("collaborator_id", id)
    .eq("is_paid", false);

  if ((openCommissions ?? 0) > 0) {
    return NextResponse.json(
      { error: "Esta colaboradora tem comissões em aberto. Pague-as antes de excluir." },
      { status: 400 }
    );
  }

  // Comissões pagas, pagamentos e vales já lançados são histórico financeiro — excluir o
  // perfil apagaria (cascade) ou bloquearia (restrict) esses registros. Preferimos manter o
  // relatório íntegro e orientar a usar "Desativar" nesses casos.
  const [{ count: commissionHistory }, { count: paymentHistory }, { count: valeHistory }] =
    await Promise.all([
      admin.from("commissions").select("id", { count: "exact", head: true }).eq("collaborator_id", id),
      admin
        .from("commission_payments")
        .select("id", { count: "exact", head: true })
        .eq("collaborator_id", id),
      admin.from("vales").select("id", { count: "exact", head: true }).eq("colaboradora_id", id),
    ]);

  if ((commissionHistory ?? 0) > 0 || (paymentHistory ?? 0) > 0 || (valeHistory ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Esta colaboradora possui histórico financeiro (comissões pagas, pagamentos ou vales). Para preservar os relatórios, use \"Desativar\" em vez de excluir.",
      },
      { status: 400 }
    );
  }

  // profiles.id referencia auth.users(id) on delete cascade — apagar o usuário remove o perfil.
  const { error: deleteError } = await admin.auth.admin.deleteUser(id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
