import type { CashTransaction, PaymentMethod } from "./types/database";

export type PaymentTotals = Record<PaymentMethod, { total: number; count: number }>;

export function computePaymentTotals(transactions: CashTransaction[]): PaymentTotals {
  const totals: PaymentTotals = {
    pix: { total: 0, count: 0 },
    dinheiro: { total: 0, count: 0 },
    credito: { total: 0, count: 0 },
    debito: { total: 0, count: 0 },
    promissoria: { total: 0, count: 0 },
  };
  for (const t of transactions) {
    if (t.type !== "entrada") continue;
    totals[t.payment_method].total += t.amount;
    totals[t.payment_method].count += 1;
  }
  return totals;
}

export interface CashSummary {
  totalEntries: number;
  totalExits: number;
  totalDay: number;
  expectedCashBalance: number;
  paymentTotals: PaymentTotals;
}

export function computeCashSummary(
  transactions: CashTransaction[],
  openingAmount: number
): CashSummary {
  const totalEntries = transactions
    .filter((t) => t.type === "entrada")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExits = transactions
    .filter((t) => t.type === "saida")
    .reduce((sum, t) => sum + t.amount, 0);
  const cashEntries = transactions
    .filter((t) => t.type === "entrada" && t.payment_method === "dinheiro")
    .reduce((sum, t) => sum + t.amount, 0);
  const cashExits = transactions
    .filter((t) => t.type === "saida" && t.payment_method === "dinheiro")
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    totalEntries,
    totalExits,
    totalDay: totalEntries - totalExits,
    expectedCashBalance: openingAmount + cashEntries - cashExits,
    paymentTotals: computePaymentTotals(transactions),
  };
}

type SupabaseBrowserClient = ReturnType<typeof import("./supabase/client").createClient>;

/**
 * Exclui uma movimentação de caixa (somente admin — garantido pela RLS) e, se o caixa
 * já estiver fechado, regrava o resumo do fechamento a partir das transações restantes.
 * O trigger `cash_transactions_recalc_totals` faz o mesmo no banco (cobre exclusões feitas
 * direto no Supabase); repetir aqui garante a consistência mesmo antes da migração.
 */
export async function deleteCashTransaction(
  supabase: SupabaseBrowserClient,
  transaction: CashTransaction
): Promise<{ error: string | null }> {
  const { data: deleted, error } = await supabase
    .from("cash_transactions")
    .delete()
    .eq("id", transaction.id)
    .select("id");
  if (error) return { error: error.message };
  if (!deleted || deleted.length === 0) {
    return { error: "Não foi possível excluir: movimentação não encontrada ou sem permissão." };
  }

  const registerId = transaction.cash_register_id;
  if (!registerId) return { error: null };

  const { data: register } = await supabase
    .from("cash_register")
    .select("id, status, opening_amount")
    .eq("id", registerId)
    .maybeSingle();
  if (!register || register.status !== "fechado") return { error: null };

  const { data: remaining, error: txError } = await supabase
    .from("cash_transactions")
    .select("*")
    .eq("cash_register_id", registerId);
  if (txError) return { error: null };

  const summary = computeCashSummary((remaining as CashTransaction[]) ?? [], register.opening_amount);
  await supabase
    .from("cash_register")
    .update({
      total_pix: summary.paymentTotals.pix.total,
      total_dinheiro: summary.paymentTotals.dinheiro.total,
      total_credito: summary.paymentTotals.credito.total,
      total_debito: summary.paymentTotals.debito.total,
      total_entries: summary.totalEntries,
      total_exits: summary.totalExits,
      total_day: summary.totalDay,
    })
    .eq("id", registerId);

  return { error: null };
}
