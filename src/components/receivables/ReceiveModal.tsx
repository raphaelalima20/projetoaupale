"use client";

import { useEffect, useState } from "react";
import { DollarSign, AlertCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import PaymentMethodSelect from "@/components/appointments/PaymentMethodSelect";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useOpenCashRegister } from "@/lib/hooks/useCashRegister";
import { useAuth } from "@/components/auth/AuthProvider";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentMethod } from "@/lib/types/database";
import type { ReceivableGroup } from "./ReceivablesSection";

interface ReceiveModalProps {
  open: boolean;
  onClose: () => void;
  onReceived: () => void;
  group: ReceivableGroup | null;
}

export default function ReceiveModal({ open, onClose, onReceived, group }: ReceiveModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile } = useAuth();
  const { register: cashRegister } = useOpenCashRegister();

  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && group) {
      setAmount(group.total.toFixed(2));
      setPaymentMethod(null);
      setError("");
    }
  }, [open, group]);

  if (!group) return null;

  async function handleSubmit() {
    if (!group) return;
    setError("");
    const amountNumber = Number(amount);
    if (!amount || amountNumber <= 0) return setError("Informe um valor válido.");
    if (amountNumber > group.total + 0.01) return setError("O valor não pode ser maior que o total pendente.");
    if (!paymentMethod) return setError("Selecione a forma de pagamento.");
    if (!cashRegister) return setError("Abra o caixa antes de registrar um recebimento.");

    setLoading(true);

    const { data: tx, error: txError } = await supabase
      .from("cash_transactions")
      .insert({
        cash_register_id: cashRegister.id,
        type: "entrada",
        amount: amountNumber,
        payment_method: paymentMethod,
        description: `Recebimento a prazo: ${group.clientName}`,
        category: "promissoria",
        affect_cash: true,
        created_by: profile?.id ?? null,
      })
      .select()
      .single();

    if (txError || !tx) {
      setError(txError?.message ?? "Não foi possível registrar o recebimento.");
      setLoading(false);
      return;
    }

    let remainingToAllocate = Math.round(amountNumber * 100) / 100;
    const sortedItems = [...group.items].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const item of sortedItems) {
      if (remainingToAllocate <= 0) break;
      const applied = Math.min(remainingToAllocate, item.remaining_amount);
      if (applied <= 0) continue;

      const newRemaining = Math.round((item.remaining_amount - applied) * 100) / 100;
      const newStatus = newRemaining <= 0 ? "pago" : "parcial";

      const { error: paymentError } = await supabase.from("receivable_payments").insert({
        receivable_id: item.id,
        amount: applied,
        payment_method: paymentMethod,
        cash_transaction_id: tx.id,
        received_by: profile?.id ?? null,
      });
      if (paymentError) {
        setError(paymentError.message);
        setLoading(false);
        return;
      }

      const { error: updateError } = await supabase
        .from("receivables")
        .update({ remaining_amount: newRemaining, status: newStatus })
        .eq("id", item.id);
      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      remainingToAllocate = Math.round((remainingToAllocate - applied) * 100) / 100;
    }

    setLoading(false);
    showToast("Recebimento registrado");
    onReceived();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Receber de ${group.clientName}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-btn border border-border p-3">
          {group.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="text-text">{item.service_name ?? "Atendimento"}</p>
                <p className="text-xs text-textDim">{formatDate(new Date(item.created_at))}</p>
              </div>
              <span className="text-text">{formatCurrency(item.remaining_amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="text-textDim">Total pendente</span>
            <span className="font-display text-xl text-gold-light">
              {formatCurrency(group.total)}
            </span>
          </div>
        </div>

        <Input
          label="Valor a receber agora (R$)"
          type="number"
          min="0"
          max={group.total}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <div>
          <p className="mb-2 text-sm text-textDim">Forma de pagamento</p>
          <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} exclude={["promissoria"]} />
        </div>

        {!cashRegister && (
          <div className="flex items-center gap-2 rounded-btn border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle size={15} className="shrink-0" />
            Abra o caixa antes de registrar um recebimento.
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            loading={loading}
            disabled={!cashRegister}
            className="flex-1"
          >
            <DollarSign size={16} />
            Confirmar Recebimento
          </Button>
        </div>
      </div>
    </Modal>
  );
}
