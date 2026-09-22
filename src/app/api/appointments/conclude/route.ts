import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEGA_COMBINACOES } from "@/lib/types/database";
import type { MegaCombinacao, MegaTecnica, MegaTipo } from "@/lib/types/database";

const AMOUNT_TOLERANCE = 0.01;

const round2 = (value: number) => Math.round(value * 100) / 100;
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

const MEGA_TECNICAS: MegaTecnica[] = ["fita", "tela", "queratina"];
const MEGA_TIPOS: MegaTipo[] = ["aplicacao", "manutencao"];

interface RemunerationResult {
  tipoRemuneracao: "comissao" | "valor_fixo";
  valorFixo: number | null;
  commissionValue: number;
}

/**
 * Resolves how much commission the collaborator earns for this appointment.
 *  - Admin may pick "valor fixo": a flat, negotiated amount — the technique/percentage is ignored.
 *  - Admin may also override the computed commission value directly (existing R$/% picker).
 *  - Otherwise, it's the collaborator's own rate (the "químico" rate when the service carries that
 *    tag) applied to `baseAmount` — for Mega Hair this is ALWAYS valor_tecnica, never valor_cabelo.
 * A collaborator concluding her own appointment can never set either of these manually.
 */
async function resolveRemuneration(
  admin: ReturnType<typeof createAdminClient>,
  {
    isAdmin,
    body,
    collaboratorId,
    isChemical,
    baseAmount,
  }: {
    isAdmin: boolean;
    body: Record<string, unknown>;
    collaboratorId: string | null;
    isChemical: boolean;
    baseAmount: number;
  }
): Promise<RemunerationResult | { error: string }> {
  if (isAdmin && body.remunerationType === "valor_fixo") {
    const raw = Number(body.valorFixo);
    if (!Number.isFinite(raw) || raw < 0) return { error: "Informe o valor fixo da colaboradora." };
    const value = round2(raw);
    return { tipoRemuneracao: "valor_fixo", valorFixo: value, commissionValue: value };
  }
  if (isAdmin && typeof body.commissionValue === "number") {
    if (body.commissionValue < 0) return { error: "Comissão inválida." };
    return { tipoRemuneracao: "comissao", valorFixo: null, commissionValue: round2(body.commissionValue) };
  }

  let percentage = 0;
  if (collaboratorId) {
    const { data: collaborator } = await admin
      .from("profiles")
      .select("commission_percentage, commission_chemical_percentage")
      .eq("id", collaboratorId)
      .maybeSingle();
    percentage = Number(isChemical ? collaborator?.commission_chemical_percentage : collaborator?.commission_percentage) || 0;
  }
  return {
    tipoRemuneracao: "comissao",
    valorFixo: null,
    commissionValue: round2((baseAmount * percentage) / 100),
  };
}

interface MegaSpec {
  tecnica: MegaTecnica;
  tipo: MegaTipo;
  combinacao: MegaCombinacao;
  comprimento: string | null;
  gramas: number | null;
  valorTecnica: number;
  valorCabelo: number;
}

/** Validates the mega-hair closing form. Never trusts the client for anything beyond field shape. */
function parseMegaSpec(raw: unknown): MegaSpec | { error: string } {
  const spec = (raw ?? {}) as Record<string, unknown>;

  const tecnica = String(spec.tecnica ?? "") as MegaTecnica;
  if (!MEGA_TECNICAS.includes(tecnica)) return { error: "Selecione a técnica do Mega Hair." };
  const tipo = String(spec.tipo ?? "") as MegaTipo;
  if (!MEGA_TIPOS.includes(tipo)) return { error: "Selecione Aplicação ou Manutenção." };
  const combinacao = String(spec.combinacao ?? "") as MegaCombinacao;
  if (!MEGA_COMBINACOES.includes(combinacao)) return { error: "Selecione a combinação." };

  const valorTecnica = Number(spec.valorTecnica);
  if (!Number.isFinite(valorTecnica) || valorTecnica <= 0) {
    return { error: "Informe o valor da técnica." };
  }
  const valorCabeloRaw = spec.valorCabelo;
  const valorCabelo =
    valorCabeloRaw === undefined || valorCabeloRaw === null || valorCabeloRaw === ""
      ? 0
      : Number(valorCabeloRaw);
  if (!Number.isFinite(valorCabelo) || valorCabelo < 0) return { error: "Valor do cabelo inválido." };

  const gramasRaw = spec.gramas;
  const gramas =
    gramasRaw === undefined || gramasRaw === null || gramasRaw === "" ? null : Number(gramasRaw);
  if (gramas !== null && (!Number.isFinite(gramas) || gramas < 0)) return { error: "Gramas inválidas." };

  const comprimento = spec.comprimento ? String(spec.comprimento).trim().slice(0, 50) || null : null;

  return {
    tecnica,
    tipo,
    combinacao,
    comprimento,
    gramas,
    valorTecnica: round2(valorTecnica),
    valorCabelo: round2(valorCabelo),
  };
}

/**
 * Concludes an appointment and records its cash entry as a single privileged operation.
 *
 * Commission: by default, the collaborator's own percentage (normal, or "químico" when the
 * service carries that tag) applied to the base amount. An admin may instead negotiate a flat
 * "valor fixo" for this one appointment, or override the computed value directly. A collaborator
 * concluding her own appointment can never set either of these — the server always computes it.
 *
 * Mega Hair (services.is_mega): nothing technical is asked at booking. At conclusion, whoever
 * closes it (admin or collaborator) fills técnica/tipo/combinação/comprimento/gramas and the two
 * amounts — valor_tecnica (commission base) and valor_cabelo (never commissioned). The final
 * amount charged is always valor_tecnica + valor_cabelo, computed here — discounts/surcharges/
 * extra services don't apply to Mega Hair.
 *
 * Collaborators have no direct RLS access to cash_register/cash_transactions/mega_especificacoes
 * writes, so this route verifies authorization itself and performs all writes with the service role.
 *
 * Three distinct outcomes, mutually exclusive:
 * - Package session (appointment.is_package_session): already paid for when the package
 *   was sold, so no cash entry and no open register required. `increment_package_session`
 *   and `create_commission_on_conclude` triggers do the rest once status flips.
 * - Promissória (a prazo): the collaborator is owed her commission immediately, but the
 *   client hasn't paid yet — no cash entry now, instead a `receivables` row is opened.
 * - Everything else (including Mega Hair): unchanged single/split cash entry flow, still
 *   requires an open register.
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

  const { data: service } = appointment.service_id
    ? await admin.from("services").select("is_chemical, is_mega").eq("id", appointment.service_id).maybeSingle()
    : { data: null };
  const isChemical = !!service?.is_chemical;
  const isMega = !!service?.is_mega;

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

    const remuneration = await resolveRemuneration(admin, {
      isAdmin,
      body,
      collaboratorId: appointment.collaborator_id,
      isChemical,
      baseAmount: packageSessionValue,
    });
    if ("error" in remuneration) return fail(remuneration.error);

    const { error: updateError } = await admin
      .from("appointments")
      .update({
        status: "concluido",
        concluded_at: new Date().toISOString(),
        final_amount: packageSessionValue,
        package_session_value: packageSessionValue,
        commission_value: remuneration.commissionValue,
        tipo_remuneracao: remuneration.tipoRemuneracao,
        valor_fixo: remuneration.valorFixo,
      })
      .eq("id", appointmentId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  // --- Mega Hair: técnica/combinação/valores are set here, not at booking; final amount is
  //     always valor_tecnica + valor_cabelo (no discount/surcharge/extras for this service). ---
  let megaSpec: MegaSpec | null = null;
  if (isMega) {
    const parsed = parseMegaSpec(body.megaSpec);
    if ("error" in parsed) return fail(parsed.error);
    megaSpec = parsed;
  }

  const {
    paymentMethod,
    discountAmount: rawDiscount = 0,
    surchargeAmount: rawSurcharge = 0,
    surchargeDescription: rawSurchargeDescription = null,
    isSplitPayment = false,
    paymentMethod2 = null,
    paymentAmount1 = null,
    paymentAmount2 = null,
  } = body;

  // Mega Hair's total is fully determined by the spec — client-sent discount/surcharge are ignored.
  const finalAmount = megaSpec
    ? round2(megaSpec.valorTecnica + megaSpec.valorCabelo)
    : Number(body.finalAmount);
  const discountAmount = megaSpec ? 0 : Number(rawDiscount) || 0;
  const surchargeAmount = megaSpec ? 0 : Number(rawSurcharge) || 0;
  const surchargeDescription = megaSpec ? null : rawSurchargeDescription;

  if (!paymentMethod || typeof finalAmount !== "number" || Number.isNaN(finalAmount) || finalAmount < 0) {
    return NextResponse.json({ error: "Dados incompletos." }, { status: 400 });
  }

  const remuneration = await resolveRemuneration(admin, {
    isAdmin,
    body,
    collaboratorId: appointment.collaborator_id,
    isChemical,
    // The base for Mega Hair's automatic percentage is ALWAYS valor_tecnica — never valor_cabelo.
    baseAmount: megaSpec ? megaSpec.valorTecnica : finalAmount,
  });
  if ("error" in remuneration) return fail(remuneration.error);

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
      commission_value: remuneration.commissionValue,
      tipo_remuneracao: remuneration.tipoRemuneracao,
      valor_fixo: remuneration.valorFixo,
      is_split_payment: isSplitPayment,
      payment_method_2: isSplitPayment ? paymentMethod2 : null,
      payment_amount_1: isSplitPayment ? paymentAmount1 : null,
      payment_amount_2: isSplitPayment ? paymentAmount2 : null,
      ...(megaSpec ? { mega_tipo: megaSpec.tipo } : {}),
    })
    .eq("id", appointmentId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (megaSpec) {
    const { error: megaError } = await admin.from("mega_especificacoes").insert({
      agendamento_id: appointmentId,
      tecnica: megaSpec.tecnica,
      tipo: megaSpec.tipo,
      combinacao: megaSpec.combinacao,
      comprimento: megaSpec.comprimento,
      gramas: megaSpec.gramas,
      valor_tecnica: megaSpec.valorTecnica,
      valor_cabelo: megaSpec.valorCabelo,
    });
    if (megaError) {
      return NextResponse.json({ error: megaError.message }, { status: 500 });
    }
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
