import Badge from "@/components/ui/Badge";
import { PAYMENT_METHODS, PAYMENT_METHOD_COLORS } from "@/lib/constants";
import { formatCurrency, formatTime, cn } from "@/lib/utils";
import type { CashTransaction } from "@/lib/types/database";

const CATEGORY_LABELS: Record<string, string> = {
  servico: "Serviço",
  venda: "Venda",
  comissao: "Comissão",
  manual: "Manual",
  outro: "Outro",
};

export default function CashTransactionItem({ transaction }: { transaction: CashTransaction }) {
  const method = PAYMENT_METHODS.find((m) => m.value === transaction.payment_method);
  const color = PAYMENT_METHOD_COLORS[transaction.payment_method];
  const isEntry = transaction.type === "entrada";
  const categoryLabel =
    CATEGORY_LABELS[transaction.category ?? ""] ?? transaction.category ?? "Manual";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-btn border border-border bg-surface p-3",
        !transaction.affect_cash && "opacity-50"
      )}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-text">{transaction.description}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-textDim">
          <span>
            {categoryLabel} · {formatTime(transaction.created_at)}
          </span>
          {!transaction.affect_cash && (
            <Badge tone="neutral" className="px-2 py-0.5 text-[10px]">
              Fora do caixa
            </Badge>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn("text-sm font-medium", isEntry ? "text-success" : "text-danger")}>
          {isEntry ? "+" : "-"}
          {formatCurrency(transaction.amount)}
        </span>
        {method && (
          <span className="text-[11px]" style={{ color }}>
            {method.label}
          </span>
        )}
      </div>
    </div>
  );
}
