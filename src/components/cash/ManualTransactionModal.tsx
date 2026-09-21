"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { PAYMENT_METHODS, CASH_CATEGORIES } from "@/lib/constants";
import type { PaymentMethod, TransactionType } from "@/lib/types/database";

interface ManualTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  type: TransactionType;
  cashRegisterId: string;
  currentUserId: string;
}

export default function ManualTransactionModal({
  open,
  onClose,
  onCreated,
  type,
  cashRegisterId,
  currentUserId,
}: ManualTransactionModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("dinheiro");
  const [category, setCategory] = useState("manual");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescription("");
    setAmount("");
    setPaymentMethod("dinheiro");
    setCategory("manual");
    setError("");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!description.trim()) {
      setError("Informe uma descrição.");
      return;
    }
    const amountNumber = Number(amount);
    if (!amount || Number.isNaN(amountNumber) || amountNumber <= 0) {
      setError("Informe um valor válido.");
      return;
    }

    setLoading(true);
    const { error: insertError } = await supabase.from("cash_transactions").insert({
      cash_register_id: cashRegisterId,
      type,
      amount: amountNumber,
      payment_method: paymentMethod,
      description: description.trim(),
      category,
      affect_cash: true,
      created_by: currentUserId,
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    showToast(type === "entrada" ? "Entrada registrada" : "Saída registrada");
    onCreated();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={type === "entrada" ? "Nova Entrada" : "Nova Saída"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={type === "entrada" ? "Ex: Venda fiado Maria" : "Ex: Aluguel da cadeira"}
          required
          autoFocus
        />
        <Input
          label="Valor (R$)"
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Select
          label="Forma de pagamento"
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <Select label="Categoria" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CASH_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button
          type="submit"
          loading={loading}
          variant={type === "entrada" ? "primary" : "danger"}
          className="mt-2 w-full"
        >
          {type === "entrada" ? <ArrowUpCircle size={16} /> : <ArrowDownCircle size={16} />}
          Salvar
        </Button>
      </form>
    </Modal>
  );
}
