import { Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseISODate } from "@/lib/schedule";
import type { Vale } from "@/lib/types/database";

interface ValeHistoryListProps {
  vales: Vale[];
  title?: string;
}

/** Compact list of vale entries — used both for a collaborator's outstanding balance and for a payment's history. */
export default function ValeHistoryList({ vales, title = "Vales em aberto" }: ValeHistoryListProps) {
  if (vales.length === 0) return null;

  const sorted = [...vales].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-center gap-1.5 text-xs text-textDim">
        <Receipt size={12} />
        {title}
      </p>
      {sorted.map((v) => (
        <div
          key={v.id}
          className="flex items-center justify-between gap-2 rounded-btn border border-warn/30 bg-warn/10 px-3 py-2 text-xs"
        >
          <div className="min-w-0">
            <p className="text-text">{formatDate(parseISODate(v.data))}</p>
            {v.descricao && <p className="truncate text-textDim">{v.descricao}</p>}
          </div>
          <p className="shrink-0 font-medium text-warn">- {formatCurrency(v.valor)}</p>
        </div>
      ))}
    </div>
  );
}
