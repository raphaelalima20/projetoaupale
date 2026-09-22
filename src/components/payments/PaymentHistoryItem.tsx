import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import Badge from "@/components/ui/Badge";
import { PAYMENT_METHODS } from "@/lib/constants";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { CommissionPayment, Profile } from "@/lib/types/database";

interface PaymentHistoryItemProps {
  payment: CommissionPayment;
  collaborator?: Profile;
  onClick: () => void;
  showCashBadge?: boolean;
}

export default function PaymentHistoryItem({
  payment,
  collaborator,
  onClick,
  showCashBadge = true,
}: PaymentHistoryItemProps) {
  const method = PAYMENT_METHODS.find((m) => m.value === payment.payment_method);

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left transition duration-200 hover:border-gold/50"
    >
      <CollaboratorAvatar
        name={payment.collaborator_name}
        color={collaborator?.avatar_color}
        photoUrl={collaborator?.photo_url}
        size={40}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{payment.collaborator_name}</p>
        <p className="text-xs text-textDim">
          {formatDateTime(payment.paid_at)} · {payment.services_count} atendimento
          {payment.services_count === 1 ? "" : "s"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="font-display text-lg text-gold-light">
          {formatCurrency(payment.total_amount)}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {method && <Badge tone="neutral">{method.label}</Badge>}
          {showCashBadge && (
            <Badge tone={payment.affect_cash ? "success" : "neutral"}>
              {payment.affect_cash ? "No caixa" : "Fora do caixa"}
            </Badge>
          )}
          {payment.vale_amount > 0 && (
            <Badge tone="orange">- {formatCurrency(payment.vale_amount)} vale</Badge>
          )}
        </div>
      </div>
    </button>
  );
}
