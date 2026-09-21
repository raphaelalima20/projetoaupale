import Card from "@/components/ui/Card";
import { PAYMENT_METHODS, PAYMENT_METHOD_COLORS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import type { PaymentTotals } from "@/lib/cash";
import type { PaymentMethod } from "@/lib/types/database";

interface PaymentBreakdownGridProps {
  totals: PaymentTotals;
  /**
   * Promissória never generates a cash_transaction (no money actually entered the
   * register), so its normal `totals.promissoria` is always zero — showing that would
   * read as "nothing sold on credit". When provided, this overrides the card with the
   * real total lançado as promissória (from `receivables`) instead.
   */
  promissoriaOverride?: { total: number; count: number };
  /** Payment methods to omit entirely — e.g. Fluxo de Caixa hides Promissória, since it never affects cash. */
  exclude?: PaymentMethod[];
}

export default function PaymentBreakdownGrid({
  totals,
  promissoriaOverride,
  exclude,
}: PaymentBreakdownGridProps) {
  const methods = exclude ? PAYMENT_METHODS.filter((m) => !exclude.includes(m.value)) : PAYMENT_METHODS;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {methods.map(({ value, label, icon: Icon }) => {
        const color = PAYMENT_METHOD_COLORS[value];
        const isPromissoria = value === "promissoria";
        const override = isPromissoria ? promissoriaOverride : undefined;
        const data = override ?? totals[value];
        return (
          <Card key={value} className="flex flex-col items-center gap-2 text-center">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: `${color}26` }}
            >
              <Icon size={20} style={{ color }} strokeWidth={1.75} />
            </div>
            <p className="text-xs text-textDim">{override ? "A Prazo" : label}</p>
            <p className="font-display text-lg text-text">{formatCurrency(data.total)}</p>
            <p className="text-[11px] text-textDim">
              {data.count} {override ? "lançamentos" : "transações"}
            </p>
          </Card>
        );
      })}
    </div>
  );
}
