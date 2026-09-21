import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const AMOUNT_TOLERANCE = 0.01;

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Default commission = the collaborator's own percentage (the "químico" rate when the service
 * carries that tag) applied to the base amount. Computed here, never trusted from a collaborator.
 */
async function defaultCommission(
  admin: ReturnType<typeof createAdminClient>,
  appointment: { collaborator_id: string | null; service_id: string | null },
  baseAmount: number
): Promise<number> {
  const [{ data: collaborator }, { data: service }] = await Promise.all([
    appointment.collaborator_id
      ? admin
          .from("profiles")
          .select("commission_percentage, commission_chemical_percentage")
          .eq("id", appointment.collaborator_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    appointment.service_id
      ? admin.from("services").select("is_chemical").eq("id", appointment.service_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const percentage = service?.is_chemical
    ? collaborator?.commission_chemical_percentage
    : collaborator?.commission_percentage;
  return round2((baseAmount * (Number(percentage) || 0)) / 100);
}

/**
 * Concludes an appointment and records its cash entry as a single privileged operation.
 *
 * Commission: the collaborator's percentage (normal or "químico") is applied automatically. Only
 * an admin may override it with a manual value; a collaborator's `commissionValue` is ignored.
 * Collaborators have no direct RLS access to cash_register/cash_transactions, so this
 * route verifies authorization itself and performs both writes with the service role.
 *
 * Three distinct outcomes, mutually exclusive:
 * - Package session (appointment.is_package_session): already paid for when the package
 *   was sold, so no cash entry and no open register required. `increment_package_session`
 *   and `create_commission_on_conclude` triggers do the rest once status flips.
 * - Promissória (a prazo): the collaborator is owed her commission immediately, but the
 *   client hasn't paid yet — no cash entry now, instead a `receivables` row is opened.
 * - Everything else: unchanged single/split cash entry flow, still requires an open register.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const { appointmentId } = body;
  if (!appointmentId) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: appointment } = await admin
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (!appointment) {
    return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
  }
  if (profile?.role !== "admin" && appointment.collaborator_id !== user.id) {
    return NextResponse.json(
      { error: "Sem permissão para concluir este agendamento." },
      { status: 403 }
    );
  }
  if (appointment.status !== "agendado") {
    return NextResponse.json({ error: "Agendamento não está mais em aberto." }, { status: 400 });
  }

  const isAdmin = profile?.role === "admin";

  // --- Package session: value is set here (not at booking), no cash entry, commission still generated ---
  if (appointment.is_package_session) {
    let packageSessionValue: number = body.packageSessionValue;
    if (!isAdmin) {
      // A collaborator can't pick the value her own commission is based on: use the package's average.
      const { data: pkg } = appointment.package_id
        ? await admin
            .from("client_packages")
            .select("total_price, total_sessions")
            .eq("id", appointment.package_id)
            .maybeSingle()
        : { data: null };
      packageSessionValue = pkg?.total_sessions ? round2(Number(pkg.total_price) / pkg.total_sessions) : 0;
    }
    if (typeof packageSessionValue !== "number" || Number.isNaN(packageSessionValue) || packageSessionValue <= 0) {
      return NextResponse.json({ error: "Informe o valor desta sessão." }, { status: 400 });
    }

    let commissionValue: number;
    if (isAdmin && typeof body.commissionValue === "number") {
      if (body.commissionValue < 0) {
        return NextResponse.json({ error: "Comissão inválida." }, { status: 400 });
      }
      commissionValue = round2(body.commissionValue);
    } else {
      commissionValue = await defaultCommission(admin, appointment, packageSessionValue);
    }

    const { error: updateError } = await admin
      .from("appointments")
      .update({
        status: "concluido",
        concluded_at: new Date().toISOString(),
        final_amount: packageSessionValue,
        package_session_value: packageSessionValue,
        commission_value: commissionValue,
      })
      .eq("id", appointmentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  const {
    paymentMethod,
    discountAmount = 0,
    surchargeAmount = 0,
    surchargeDescription = null,
    finalAmount,
    isSplitPayment = false,
    paymentMethod2 = null,
    paymentAmount1 = null,
    paymentAmount2 = null,
  } = body;

  if (!paymentMethod || typeof finalAmount !== "number" || finalAmount < 0) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }
  let commissionValue: number;
  if (isAdmin && typeof body.commissionValue === "number") {
    if (body.commissionValue < 0) {
      return NextResponse.json({ error: "Comissão inválida." }, { status: 400 });
    }
    commissionValue = round2(body.commissionValue);
  } else {
    commissionValue = await defaultCommission(admin, appointment, finalAmount);
  }
  if (isSplitPayment) {
    if (!paymentMethod2 || typeof paymentAmount1 !== "number" || typeof paymentAmount2 !== "number") {
      return NextResponse.json(
        { error: "Informe as duas formas de pagamento e seus valores." },
        { status: 400 }
      );
    }
    if (Math.abs(paymentAmount1 + paymentAmount2 - finalAmount) > AMOUNT_TOLERANCE) {
      return NextResponse.json(
        { error: "A soma dos valores não corresponde ao total." },
        { status: 400 }
      );
    }
  }

  const isPromissoria = !isSplitPayment && paymentMethod === "promissoria";

  let register: { id: string } | null = null;
  if (!isPromissoria) {
    const { data: openRegister } = await admin
      .from("cash_register")
      .select("id")
      .eq("status", "aberto")
      .maybeSingle();
    if (!openRegister) {
      return NextResponse.json(
        { error: "Abra o caixa antes de concluir atendimentos." },
        { status: 400 }
      );
    }
    register = openRegister;
  }

  const { error: updateError } = await admin
    .from("appointments")
    .update({
      status: "concluido",
      payment_method: paymentMethod,
      concluded_at: new Date().toISOString(),
      discount_amount: discountAmount,
      surcharge_amount: surchargeAmount,
      surcharge_description: surchargeDescription,
      final_amount: finalAmount,
      commission_value: commissionValue,
      is_split_payment: isSplitPayment,
      payment_method_2: isSplitPayment ? paymentMethod2 : null,
      payment_amount_1: isSplitPayment ? paymentAmount1 : null,
      payment_amount_2: isSplitPayment ? paymentAmount2 : null,
    })
    .eq("id", appointmentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const baseDescription = `${appointment.service_name} — ${appointment.client_name}`;

  // --- Promissória: commission was just generated above, but no money came in yet ---
  if (isPromissoria) {
    const { error: receivableError } = await admin.from("receivables").insert({
      client_id: appointment.client_id,
      client_name: appointment.client_name,
      client_phone: appointment.client_phone,
      appointment_id: appointment.id,
      service_name: appointment.service_name,
      original_amount: finalAmount,
      remaining_amount: finalAmount,
      status: "pendente",
      created_by: user.id,
    });
    if (receivableError) {
      return NextResponse.json({ error: receivableError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  if (!register) {
    return NextResponse.json(
      { error: "Abra o caixa antes de concluir atendimentos." },
      { status: 400 }
    );
  }

  const transactions = isSplitPayment
    ? [
        {
          cash_register_id: register.id,
          type: "entrada",
          amount: paymentAmount1,
          payment_method: paymentMethod,
          description: baseDescription,
          category: "servico",
          appointment_id: appointment.id,
          affect_cash: true,
          created_by: user.id,
        },
        {
          cash_register_id: register.id,
          type: "entrada",
          amount: paymentAmount2,
          payment_method: paymentMethod2,
          description: baseDescription,
          category: "servico",
          appointment_id: appointment.id,
          affect_cash: true,
          created_by: user.id,
        },
      ]
    : [
        {
          cash_register_id: register.id,
          type: "entrada",
          amount: finalAmount,
          payment_method: paymentMethod,
          description: baseDescription,
          category: "servico",
          appointment_id: appointment.id,
          affect_cash: true,
          created_by: user.id,
        },
      ];

  const { error: transactionError } = await admin.from("cash_transactions").insert(transactions);

  if (transactionError) {
    return NextResponse.json({ error: transactionError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
