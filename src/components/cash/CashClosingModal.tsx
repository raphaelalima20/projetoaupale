"use client";

import { FormEvent, useState } from "react";
import { Lock } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { formatCurrency, cn } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/constants";
import type { PaymentTotals } from "@/lib/cash";

interface CashClosingModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => void;
  loading: boolean;
  openingAmount: number;
  totalEntries: number;
  totalExits: number;
  totalDay: number;
  expectedCashBalance: number;
  paymentTotals: PaymentTotals;
}

export default function CashClosingModal({
  open,
  onClose,
  onConfirm,
  loading,
  openingAmount,
  totalEntries,
  totalExits,
  totalDay,
  expectedCashBalance,
  paymentTotals,
}: CashClosingModalProps) {
  const [notes, setNotes] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onConfirm(notes);
  }

  return (
    <Modal open={open} onClose={onClose} title="Fechar Caixa">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-btn bg-surface2 p-4 text-sm">
          <Row label="Abertura" value={formatCurrency(openingAmount)} />
          <Row label="Total de entradas" value={formatCurrency(totalEntries)} valueClass="text-success" />
          <Row label="Total de saídas" value={formatCurrency(totalExits)} valueClass="text-danger" />
          <div className="my-1 border-t border-border" />
          {PAYMENT_METHODS.map((m) => (
            <Row key={m.value} label={m.label} value={formatCurrency(paymentTotals[m.value].total)} />
          ))}
          <div className="my-1 border-t border-border" />
          <Row
            label="Resultado do dia"
            value={formatCurrency(totalDay)}
            valueClass={totalDay >= 0 ? "text-success" : "text-danger"}
            bold
          />
          <Row label="Saldo esperado em dinheiro" value={formatCurrency(expectedCashBalance)} bold />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="closing-notes" className="text-sm text-textDim">
            Observações do fechamento
          </label>
          <textarea
            id="closing-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-btn border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none transition duration-200 focus:border-gold"
            placeholder="Opcional"
          />
        </div>

        <Button type="submit" variant="danger" loading={loading} className="mt-2 w-full">
          <Lock size={16} />
          Confirmar Fechamento
        </Button>
      </form>
    </Modal>
  );
}

function Row({
  label,
  value,
  valueClass,
  bold,
}: {
  label: string;
  value: string;
  valueClass?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-textDim", bold && "text-text")}>{label}</span>
      <span className={cn(valueClass ?? "text-text", bold && "font-medium")}>{value}</span>
    </div>
  );
}
