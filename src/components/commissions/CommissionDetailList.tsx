"use client";

import { useState } from "react";
import { ChevronDown, Package } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { parseISODate } from "@/lib/schedule";
import type { Commission } from "@/lib/types/database";

interface CommissionDetailListProps {
  commissions: Commission[];
  collapsible?: boolean;
  defaultExpanded?: boolean;
  /** appointment_id's that are package sessions, so their row can show a "Pacote" indicator. */
  packageAppointmentIds?: Set<string>;
}

export default function CommissionDetailList({
  commissions,
  collapsible = true,
  defaultExpanded = false,
  packageAppointmentIds,
}: CommissionDetailListProps) {
  const [expanded, setExpanded] = useState(defaultExpanded || !collapsible);

  const sorted = [...commissions].sort((a, b) => a.commission_date.localeCompare(b.commission_date));

  return (
    <div>
      {collapsible && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1.5 text-xs text-textDim transition duration-200 hover:text-gold"
        >
          <ChevronDown size={14} className={cn("transition duration-200", expanded && "rotate-180")} />
          {expanded ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
      )}
      {expanded && (
        <div className="mt-3 flex flex-col gap-1.5">
          {sorted.length === 0 ? (
            <p className="text-xs text-textDim">Nenhum atendimento neste período</p>
          ) : (
            sorted.map((c) => {
              const isPackage = !!c.appointment_id && packageAppointmentIds?.has(c.appointment_id);
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-btn border border-border/60 bg-surface2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-textDim">{formatDate(parseISODate(c.commission_date))}</p>
                    <p className="truncate text-text">
                      {c.client_name} · {c.service_name}
                    </p>
                    {isPackage && (
                      <Badge tone="info" className="mt-1 gap-1">
                        <Package size={10} />
                        Pacote
                      </Badge>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-textDim">{formatCurrency(c.service_value)}</p>
                    <p className="font-medium text-gold">{formatCurrency(c.commission_value)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
