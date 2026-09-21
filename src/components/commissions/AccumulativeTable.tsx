import Badge from "@/components/ui/Badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { parseISODate } from "@/lib/schedule";
import type { AccumulativeRow } from "@/lib/commissions";

export default function AccumulativeTable({ rows }: { rows: AccumulativeRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-textDim">Nenhum atendimento nesta semana</p>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-border sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface2 text-left text-xs text-textDim">
              <th className="px-3 py-2 font-medium">Dia</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Serviço</th>
              <th className="px-3 py-2 text-right font-medium">Valor Serviço</th>
              <th className="px-3 py-2 text-right font-medium">Comissão</th>
              <th className="px-3 py-2 text-right font-medium">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className={cn("border-b border-border/60 last:border-0", r.is_paid && "opacity-60")}
              >
                <td className="px-3 py-2.5 text-text">{formatDate(parseISODate(r.commission_date))}</td>
                <td className="px-3 py-2.5 text-text">{r.client_name}</td>
                <td className="px-3 py-2.5 text-textDim">
                  <div className="flex items-center gap-2">
                    {r.service_name}
                    {r.is_paid && <Badge tone="success">Paga</Badge>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right text-textDim">
                  {formatCurrency(r.service_value)}
                </td>
                <td className="px-3 py-2.5 text-right text-text">
                  {formatCurrency(r.commission_value)}
                </td>
                <td className="px-3 py-2.5 text-right font-display text-gold-light">
                  {formatCurrency(r.runningTotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:hidden">
        {rows.map((r) => (
          <div
            key={r.id}
            className={cn(
              "rounded-btn border border-border bg-surface p-3",
              r.is_paid && "opacity-60"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-text">{formatDate(parseISODate(r.commission_date))}</p>
              {r.is_paid && <Badge tone="success">Paga</Badge>}
            </div>
            <p className="mt-1 text-sm text-text">
              {r.client_name} · {r.service_name}
            </p>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-textDim">
                Serviço {formatCurrency(r.service_value)} · Comissão{" "}
                {formatCurrency(r.commission_value)}
              </span>
              <span className="font-display text-sm text-gold-light">
                {formatCurrency(r.runningTotal)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
