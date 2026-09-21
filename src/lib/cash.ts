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
