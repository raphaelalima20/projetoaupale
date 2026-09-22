"use client";

import { FormEvent, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { toISODate } from "@/lib/schedule";
import type { Profile } from "@/lib/types/database";

interface ValeDeductModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  collaborator: Profile;
}

/**
 * "Descontar Vale" — lança um vale no dia em que acontece, independente do pagamento de
 * comissão. Ele fica em aberto e é descontado automaticamente no próximo pagamento
 * (ver RPC pay_commissions), sem precisar reabrir esse popup depois.
 */
export default function ValeDeductModal({ open, onClose, onSaved, collaborator }: ValeDeductModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { profile } = useAuth();

  const [valor, setValor] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(toISODate(new Date()));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValor("");
    setDescricao("");
    setData(toISODate(new Date()));
    setError("");
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const valorNumber = Number(valor);
    if (!valor || Number.isNaN(valorNumber) || valorNumber <= 0) {
      setError("Informe um valor válido.");
      return;
    }
    if (!data) {
      setError("Informe a data.");
      return;
    }

    setLoading(true);
    const { error: insertError } = await supabase.from("vales").insert({
      colaboradora_id: collaborator.id,
      valor: valorNumber,
      descricao: descricao.trim() || null,
      data,
      created_by: profile?.id ?? null,
    });
    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    showToast("Vale lançado");
    onSaved();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Descontar Vale — ${collaborator.full_name}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Valor do vale (R$)"
          type="number"
          min="0.01"
          step="0.01"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="0,00"
          required
          autoFocus
        />
        <Input
          label="Descrição / motivo"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex: adiantamento, material, empréstimo"
        />
        <Input
          label="Data"
          type="date"
          value={data}
          max={toISODate(new Date())}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <p className="text-xs text-textDim">
          O vale fica em aberto e é descontado automaticamente do próximo pagamento de comissão
          desta colaboradora.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="mt-2 w-full">
          <Receipt size={16} />
          Lançar Vale
        </Button>
      </form>
    </Modal>
  );
}
