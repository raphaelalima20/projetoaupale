"use client";

import { useEffect, useState } from "react";
import { Banknote, Minus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Toggle from "@/components/ui/Toggle";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import PaymentMethodSelect from "@/components/appointments/PaymentMethodSelect";
import CashToggle from "./CashToggle";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useOpenCashRegister } from "@/lib/hooks/useCashRegister";
import { computeTotals, computePendingPeriod } from "@/lib/commissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseISODate } from "@/lib/schedule";
import type { Commission, PaymentMethod, Profile } from "@/lib/types/database";

interface CommissionPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
  collaborator: Profile;
  pendingCommissions: Commission[];
}

export default function CommissionPaymentModal({
  open,
  onClose,
  onPaid,
  collaborator,
  pendingCommissions,
}: CommissionPaymentModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { register: cashRegister } = useOpenCashRegister();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [affectCash, setAffectCash] = useState(true);
  const [applyVale, setApplyVale] = useState(false);
  const [valeAmount, setValeAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPaymentMethod(null);
    setAffectCash(true);
    setApplyVale(false);
    setValeAmount("");
    setNotes("");
    setError("");
  }, [open]);

  const totals = computeTotals(pendingCommissions);
  const period = computePendingPeriod(pendingCommissions);
  const valeNumber = applyVale ? Math.min(Number(valeAmount) || 0, totals.totalCommission) : 0;
  const amountToPay = Math.round((totals.totalCommission - valeNumber) * 100) / 100;
  const canConfirm =
    !!paymentMethod && (!affectCash || !!cashRegister) && (!applyVale || valeNumber >= 0);

  async function handleConfirm() {
    if (!paymentMethod || !canConfirm) return;
    setError("");
    setLoading(true);

    // One atomic database call: registers the payment, zeroes these commissions (starting a new
    // cycle) and, when it should hit the cash, records the outflow — all or nothing.
    const { error: paymentError } = await supabase.rpc("pay_commissions", {
      p_collaborator_id: collaborator.id,
      p_commission_ids: pendingCommissions.map((c) => c.id),
      p_payment_method: paymentMethod,
      p_affect_cash: affectCash,
      p_vale_amount: valeNumber,
      p_notes: notes.trim() || null,
    });

    if (paymentError) {
      setError(paymentError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    showToast("Pagamento realizado com sucesso");
    onPaid();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Pagar Comissões — ${collaborator.full_name}`}>
      <div className="mb-4 flex items-center gap-3">
        <CollaboratorAvatar
          name={collaborator.full_name}
          color={collaborator.avatar_color}
          photoUrl={collaborator.photo_url}
          size={40}
        />
        <p className="text-sm text-text">{collaborator.full_name}</p>
      </div>

      <div className="mb-5 flex flex-col gap-2 rounded-btn bg-surface2 p-4 text-sm">
        <Row
          label="Período"
          value={`${period.start ? formatDate(parseISODate(period.start)) : "—"} a ${formatDate(
            parseISODate(period.end)
          )}`}
        />
        <Row label="Atendimentos" value={String(pendingCommissions.length)} />
        <Row label="Valor em serviços" value={formatCurrency(totals.totalService)} />
        <div className="my-1 border-t border-border" />
        <Row label="Comissão total" value={formatCurrency(totals.totalCommission)} />
        {applyVale && valeNumber > 0 && (
          <Row label="Vale" value={`- ${formatCurrency(valeNumber)}`} />
        )}
        <div className="flex items-center justify-between">
          <span className="text-textDim">A pagar</span>
          <span className="font-display text-2xl text-gold-light">
            {formatCurrency(amountToPay)}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm text-textDim">Forma de pagamento</p>
          <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
        </div>

        <CashToggle
          checked={affectCash}
          onChange={setAffectCash}
          cashRegisterOpen={!!cashRegister}
        />

        <div className="flex flex-col gap-2">
          <div className="rounded-btn border border-border p-3">
            <Toggle
              checked={applyVale}
              onChange={setApplyVale}
              label="Abater vale"
              description="Desconta um adiantamento já dado à colaboradora"
            />
          </div>
          {applyVale && (
            <div className="relative">
              <Minus
                size={14}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-textDim"
              />
              <input
                type="number"
                min="0"
                max={totals.totalCommission}
                step="0.01"
                value={valeAmount}
                onChange={(e) => setValeAmount(e.target.value)}
                placeholder="Valor do vale (R$)"
                className="w-full rounded-btn border border-border bg-surface2 py-2.5 pl-9 pr-4 text-sm text-text placeholder:text-textDim/60 outline-none transition duration-200 focus:border-gold"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="payment-notes" className="text-sm text-textDim">
            Observações
          </label>
          <textarea
            id="payment-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-btn border border-border bg-surface2 px-4 py-2.5 text-sm text-text outline-none transition duration-200 focus:border-gold"
            placeholder="Opcional"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleConfirm} loading={loading} disabled={!canConfirm} className="flex-1">
            <Banknote size={16} />
            Confirmar Pagamento
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-textDim">{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}
