"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
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

interface CashTransactionItemProps {
  transaction: CashTransaction;
  /** Quando informado, mostra a lixeira (somente admin). Deve resolver com a mensagem de erro, se houver. */
  onDelete?: (transaction: CashTransaction) => Promise<string | null>;
}

export default function CashTransactionItem({ transaction, onDelete }: CashTransactionItemProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const method = PAYMENT_METHODS.find((m) => m.value === transaction.payment_method);
  const color = PAYMENT_METHOD_COLORS[transaction.payment_method];
  const isEntry = transaction.type === "entrada";
  const categoryLabel =
    CATEGORY_LABELS[transaction.category ?? ""] ?? transaction.category ?? "Manual";

  async function handleConfirm() {
    if (!onDelete) return;
    setDeleting(true);
    setError("");
    const err = await onDelete(transaction);
    setDeleting(false);
    if (err) {
      setError(err);
      return;
    }
    setConfirmOpen(false);
  }

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
      {onDelete && (
        <button
          type="button"
          onClick={() => {
            setError("");
            setConfirmOpen(true);
          }}
          className="shrink-0 rounded-btn p-2 text-danger transition duration-200 hover:bg-danger/15"
          aria-label="Excluir movimentação"
          title="Excluir movimentação"
        >
          <Trash2 size={16} />
        </button>
      )}

      {onDelete && (
        <Modal
          open={confirmOpen}
          onClose={() => !deleting && setConfirmOpen(false)}
          title="Excluir movimentação"
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text">
              Tem certeza que deseja excluir esta movimentação de{" "}
              <strong>{formatCurrency(transaction.amount)}</strong>? Os totais do caixa serão
              recalculados automaticamente.
            </p>
            <p className="truncate text-xs text-textDim">
              {isEntry ? "Entrada" : "Saída"} · {transaction.description || categoryLabel}
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirm}
                loading={deleting}
                className="flex-1"
              >
                <Trash2 size={16} />
                Excluir
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
