"use client";

import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";
import Modal from "@/components/ui/Modal";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import CommissionDetailList from "@/components/commissions/CommissionDetailList";
import { createClient } from "@/lib/supabase/client";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { parseISODate } from "@/lib/schedule";
import type { Commission, CommissionPayment, Profile } from "@/lib/types/database";

interface PaymentDetailModalProps {
  open: boolean;
  onClose: () => void;
  payment: CommissionPayment | null;
  collaborator?: Profile;
  showAdminFields?: boolean;
}

export default function PaymentDetailModal({
  open,
  onClose,
  payment,
  collaborator,
  showAdminFields = true,
}: PaymentDetailModalProps) {
  const [supabase] = useState(() => createClient());
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [paidByProfile, setPaidByProfile] = useState<Profile | null>(null);
  const [packageAppointmentIds, setPackageAppointmentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !payment) return;
    setLoading(true);
    setPaidByProfile(null);

    supabase
      .from("commissions")
      .select("*")
      .eq("payment_id", payment.id)
      .then(async ({ data }) => {
        const list = (data as Commission[]) ?? [];
        setCommissions(list);
        setLoading(false);

        const appointmentIds = Array.from(
          new Set(list.map((c) => c.appointment_id).filter((id): id is string => !!id))
        );
        if (appointmentIds.length === 0) {
          setPackageAppointmentIds(new Set());
          return;
        }
        const { data: pkgAppointments } = await supabase
          .from("appointments")
          .select("id")
          .in("id", appointmentIds)
          .eq("is_package_session", true);
        setPackageAppointmentIds(new Set((pkgAppointments ?? []).map((a) => a.id as string)));
      });

    if (showAdminFields && payment.paid_by) {
      supabase
        .from("profiles")
        .select("*")
        .eq("id", payment.paid_by)
        .maybeSingle()
        .then(({ data }) => setPaidByProfile((data as Profile) ?? null));
    }
  }, [open, payment, supabase, showAdminFields]);

  if (!payment) return null;

  const method = PAYMENT_METHODS.find((m) => m.value === payment.payment_method);

  return (
    <Modal open={open} onClose={onClose} title="Detalhes do Pagamento">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <CollaboratorAvatar
            name={payment.collaborator_name}
            color={collaborator?.avatar_color}
            photoUrl={collaborator?.photo_url}
            size={44}
          />
          <div>
            <p className="text-sm font-medium text-text">{payment.collaborator_name}</p>
            <p className="text-xs text-textDim">{formatDateTime(payment.paid_at)}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-btn bg-surface2 p-4 text-sm">
          <Row
            label="Período"
            value={`${formatDate(parseISODate(payment.period_start))} a ${formatDate(
              parseISODate(payment.period_end)
            )}`}
          />
          <Row label="Atendimentos" value={String(payment.services_count)} />
          <Row label="Forma de pagamento" value={method?.label ?? payment.payment_method} />
          {showAdminFields && (
            <Row label="Incidiu no caixa" value={payment.affect_cash ? "Sim" : "Não"} />
          )}
          {showAdminFields && paidByProfile && (
            <Row label="Pago por" value={paidByProfile.full_name} />
          )}
          <div className="my-1 border-t border-border" />
          <div className="flex items-center justify-between">
            <span className="text-textDim">Valor total</span>
            <span className="font-display text-xl text-gold-light">
              {formatCurrency(payment.total_amount)}
            </span>
          </div>
        </div>

        {payment.notes && (
          <div className="flex items-start gap-2 text-sm text-textDim">
            <StickyNote size={15} className="mt-0.5 shrink-0" />
            {payment.notes}
          </div>
        )}

        <div>
          <p className="mb-2 text-sm text-textDim">Atendimentos pagos neste lote</p>
          {loading ? (
            <p className="text-xs text-textDim">Carregando...</p>
          ) : (
            <CommissionDetailList
              commissions={commissions}
              collapsible={false}
              packageAppointmentIds={packageAppointmentIds}
            />
          )}
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
