"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Card from "@/components/ui/Card";
import CashRegisterStatus from "./CashRegisterStatus";
import CashTransactionItem from "./CashTransactionItem";
import { formatCurrency, formatDate, formatTime, cn } from "@/lib/utils";
import type { CashRegister, CashTransaction } from "@/lib/types/database";

interface CashRegisterListItemProps {
  register: CashRegister;
  transactions: CashTransaction[];
}

export default function CashRegisterListItem({
  register,
  transactions,
}: CashRegisterListItemProps) {
  const [expanded, setExpanded] = useState(false);
  const entries = transactions.filter((t) => t.type === "entrada").reduce((s, t) => s + t.amount, 0);
  const exits = transactions.filter((t) => t.type === "saida").reduce((s, t) => s + t.amount, 0);
  const total = entries - exits;

  return (
    <Card padded={false} className="overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <p className="text-sm font-medium text-text">{formatDate(new Date(register.opened_at))}</p>
          <p className="text-xs text-textDim">
            Aberto às {formatTime(register.opened_at)}
            {register.closed_at && ` — Fechado às ${formatTime(register.closed_at)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <CashRegisterStatus status={register.status} />
          <span className="text-sm font-medium text-text">{formatCurrency(total)}</span>
          <ChevronDown
            size={16}
            className={cn("text-textDim transition duration-200", expanded && "rotate-180")}
          />
        </div>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-border p-4">
          {transactions.length === 0 ? (
            <p className="text-sm text-textDim">Nenhuma movimentação</p>
          ) : (
            transactions
              .slice()
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((t) => <CashTransactionItem key={t.id} transaction={t} />)
          )}
        </div>
      )}
    </Card>
  );
}
