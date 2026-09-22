import { Banknote, Receipt } from "lucide-react";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import SpecialtyText from "@/components/collaborators/SpecialtyText";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import WeekdayBreakdownGrid from "./WeekdayBreakdownGrid";
import CommissionDetailList from "./CommissionDetailList";
import ValeHistoryList from "./ValeHistoryList";
import { computeWeekdayBreakdown, computeTotals, computePendingPeriod } from "@/lib/commissions";
import { formatCurrency, formatDate } from "@/lib/utils";
import { parseISODate } from "@/lib/schedule";
import type { Profile, Commission, Vale } from "@/lib/types/database";

interface CommissionCardProps {
  collaborator: Profile;
  displayCommissions: Commission[];
  pendingCommissions: Commission[];
  outstandingVales: Vale[];
  weekStart: Date;
  onPay: () => void;
  onDeductVale: () => void;
  packageAppointmentIds?: Set<string>;
}

export default function CommissionCard({
  collaborator,
  displayCommissions,
  pendingCommissions,
  outstandingVales,
  weekStart,
  onPay,
  onDeductVale,
  packageAppointmentIds,
}: CommissionCardProps) {
  const totals = computeTotals(displayCommissions);
  const breakdown = computeWeekdayBreakdown(displayCommissions, weekStart);
  const period = computePendingPeriod(pendingCommissions);
  const valeTotal = outstandingVales.reduce((sum, v) => sum + v.valor, 0);
  const netTotal = Math.max(0, totals.totalCommission - valeTotal);

  return (
    <Card
      className="animate-fadeIn"
      style={{ borderLeftWidth: 3, borderLeftColor: collaborator.avatar_color || "#C7A593" }}
    >
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
        <div className="flex items-center gap-3">
          <CollaboratorAvatar
            name={collaborator.full_name}
            color={collaborator.avatar_color}
            photoUrl={collaborator.photo_url}
            size={44}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text">{collaborator.full_name}</p>
            <div className="flex min-w-0 items-center gap-1 text-xs text-textDim">
              <SpecialtyText specialty={collaborator.specialty} />
              <span className="shrink-0">
                · {totals.count} atendimento{totals.count === 1 ? "" : "s"}
              </span>
            </div>
            {period.start && (
              <p className="text-[11px] text-textDim">Desde {formatDate(parseISODate(period.start))}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl text-gold-light">
            {formatCurrency(valeTotal > 0 ? netTotal : totals.totalCommission)}
          </p>
          <p className="text-xs text-textDim">de {formatCurrency(totals.totalService)} em serviços</p>
        </div>
      </div>

      <div className="mt-4">
        <WeekdayBreakdownGrid days={breakdown} />
      </div>

      {valeTotal > 0 && (
        <div className="mt-4 flex flex-col gap-1.5 rounded-btn bg-surface2 p-3 text-xs">
          <Row label="Comissão bruta" value={formatCurrency(totals.totalCommission)} />
          <Row label="Vales descontados" value={`- ${formatCurrency(valeTotal)}`} />
          <div className="flex items-center justify-between border-t border-border pt-1.5 font-medium text-text">
            <span>Comissão líquida</span>
            <span>{formatCurrency(netTotal)}</span>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {pendingCommissions.length > 0 && (
          <Button onClick={onPay} className="flex-1">
            <Banknote size={16} />
            Pagar Colaboradora
          </Button>
        )}
        <Button onClick={onDeductVale} variant="secondary" className="flex-1">
          <Receipt size={16} />
          Descontar Vale
        </Button>
      </div>

      {outstandingVales.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <ValeHistoryList vales={outstandingVales} />
        </div>
      )}

      <div className="mt-4 border-t border-border pt-3">
        <CommissionDetailList
          commissions={displayCommissions}
          packageAppointmentIds={packageAppointmentIds}
        />
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-textDim">
      <span>{label}</span>
      <span className="text-text">{value}</span>
    </div>
  );
}
