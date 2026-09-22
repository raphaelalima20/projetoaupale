"use client";

import { useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import PaymentMethodSelect from "@/components/appointments/PaymentMethodSelect";
import CashToggle from "./CashToggle";
import ValeHistoryList from "./ValeHistoryList";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import { useOpenCashRegister } from "@/lib/hooks/useCashRegister";
import { computeTotals, computePendingPeriod } from "@/lib/commissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseISODate } from "@/lib/schedule";
import type { Commission, PaymentMethod, Profile, Vale } from "@/lib/types/database";

interface CommissionPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
  collaborator: Profile;
  pendingCommissions: Commission[];
  /** Vales in aberto desta colaboradora — já filtrados pelo chamador. */
  outstandingVales: Vale[];
}

/**
 * Pagar Colaboradora. Os vales NÃO são digitados aqui — eles já foram lançados no dia em que
 * aconteceram (ver "Descontar Vale") e são descontados automaticamente pela RPC pay_commissions,
 * do mais antigo para o mais novo, sem nunca ultrapassar a comissão bruta deste lote.
 */
export default function CommissionPaymentModal({
  open,
  onClose,
  onPaid,
  collaborator,
  pendingCommissions,
  outstandingVales,
}: CommissionPaymentModalProps) {
  const [supabase] = useState(() => createClient());
  const { showToast } = useToast();
  const { register: cashRegister } = useOpenCashRegister();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [affectCash, setAffectCash] = useState(true);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPaymentMethod(null);
    setAffectCash(true);
    setNotes("");
    setError("");
  }, [open]);

  const totals = computeTotals(pendingCommissions);
  const period = computePendingPeriod(pendingCommissions);
  const valeTotalRaw = outstandingVales.reduce((sum, v) => sum + v.valor, 0);
  // Prévia: a RPC só consome vales que cabem inteiros na comissão bruta, do mais antigo ao mais
  // novo — se um vale não couber, ele continua em aberto e o valor real pode diferir um pouco
  // desta estimativa simples.
  const valePreview = Math.min(valeTotalRaw, totals.totalCommission);
  const amountToPay = Math.round((totals.totalCommission - valePreview) * 100) / 100;
  const valeExceeds = valeTotalRaw > totals.totalCommission;
  const canConfirm = !!paymentMethod && (!affectCash || !!cashRegister);

  async function handleConfirm() {
    if (!paymentMethod || !canConfirm) return;
    setError("");
    setLoading(true);

    // One atomic database call: registers the payment, zeroes these commissions (starting a new
    // cycle), descontar os vales em aberto que couberem e, quando deve incidir no caixa, registra
    // a saída — tudo ou nada.
    const { error: paymentError } = await supabase.rpc("pay_commissions", {
      p_collaborator_id: collaborator.id,
      p_commission_ids: pendingCommissions.map((c) => c.id),
      p_payment_method: paymentMethod,
      p_affect_cash: affectCash,
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
        <Row label="Comissão bruta" value={formatCurrency(totals.totalCommission)} />
        {valePreview > 0 && <Row label="Vale descontado" value={`- ${formatCurrency(valePreview)}`} />}
        <div className="flex items-center justify-between">
          <span className="text-textDim">A pagar</span>
          <span className="font-display text-2xl text-gold-light">
            {formatCurrency(amountToPay)}
          </span>
        </div>
        {valeExceeds && (
          <p className="text-xs text-warn">
            O saldo de vales ({formatCurrency(valeTotalRaw)}) é maior que a comissão bruta — parte
            dele continuará em aberto e será descontada no próximo pagamento.
          </p>
        )}
      </div>

      {outstandingVales.length > 0 && (
        <div className="mb-5">
          <ValeHistoryList vales={outstandingVales} title="Vales que serão descontados" />
        </div>
      )}

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
