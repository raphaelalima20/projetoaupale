"use client";

import { useEffect, useState } from "react";
import { Gem } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import CommissionCard from "@/components/commissions/CommissionCard";
import CommissionPaymentModal from "@/components/commissions/CommissionPaymentModal";
import ValeDeductModal from "@/components/commissions/ValeDeductModal";
import WeekRangeNavigator from "@/components/commissions/WeekRangeNavigator";
import { useCommissions } from "@/lib/hooks/useCommissions";
import { useCollaborators } from "@/lib/hooks/useCollaborators";
import { useVales } from "@/lib/hooks/useVales";
import { createClient } from "@/lib/supabase/client";
import { groupByCollaborator } from "@/lib/commissions";
import { getMonday, addDays } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import type { Profile } from "@/lib/types/database";

type FilterMode = "pending" | "all";

export default function ComissoesPage() {
  const [supabase] = useState(() => createClient());
  const { collaborators, loading: loadingCollaborators } = useCollaborators();
  const { commissions, loading: loadingCommissions, refetch } = useCommissions();
  const { vales, refetch: refetchVales } = useVales();
  const [filterMode, setFilterMode] = useState<FilterMode>("pending");
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [payingCollaborator, setPayingCollaborator] = useState<Profile | null>(null);
  const [deductingValeFor, setDeductingValeFor] = useState<Profile | null>(null);
  const [packageAppointmentIds, setPackageAppointmentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const appointmentIds = Array.from(
      new Set(commissions.map((c) => c.appointment_id).filter((id): id is string => !!id))
    );
    if (appointmentIds.length === 0) {
      setPackageAppointmentIds(new Set());
      return;
    }
    let active = true;
    supabase
      .from("appointments")
      .select("id")
      .in("id", appointmentIds)
      .eq("is_package_session", true)
      .then(({ data }) => {
        if (active) setPackageAppointmentIds(new Set((data ?? []).map((a) => a.id as string)));
      });
    return () => {
      active = false;
    };
  }, [commissions, supabase]);

  const loading = loadingCollaborators || loadingCommissions;
  const byCollaborator = groupByCollaborator(commissions);

  function handleChangeWeek(direction: -1 | 1) {
    setWeekStart(addDays(weekStart, direction * 7));
  }

  function outstandingValesFor(collaboratorId: string) {
    return vales.filter((v) => v.colaboradora_id === collaboratorId && !v.commission_payment_id);
  }

  const pendingForPaying = payingCollaborator
    ? (byCollaborator.get(payingCollaborator.id) ?? []).filter((c) => !c.is_paid)
    : [];

  function handlePaid() {
    refetch();
    refetchVales();
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title="Comissões"
        subtitle="Acompanhe as comissões pendentes de cada colaboradora"
        actions={<WeekRangeNavigator weekStart={weekStart} onChangeWeek={handleChangeWeek} />}
      />

      <div className="mb-6 flex gap-2">
        {(["pending", "all"] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={cn(
              "rounded-badge border px-3.5 py-1.5 text-xs font-medium transition duration-200",
              filterMode === mode
                ? "border-gold bg-gold-dim text-gold-light"
                : "border-border text-textDim hover:border-gold/40 hover:text-text"
            )}
          >
            {mode === "pending" ? "Pendentes" : "Todas"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : collaborators.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Gem size={28} className="text-textDim" strokeWidth={1.5} />
          <p className="text-sm text-textDim">Nenhuma colaboradora ativa cadastrada</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {collaborators.map((collaborator) => {
            const all = byCollaborator.get(collaborator.id) ?? [];
            const pending = all.filter((c) => !c.is_paid);
            const display = filterMode === "pending" ? pending : all;
            return (
              <CommissionCard
                key={collaborator.id}
                collaborator={collaborator}
                displayCommissions={display}
                pendingCommissions={pending}
                outstandingVales={outstandingValesFor(collaborator.id)}
                weekStart={weekStart}
                onPay={() => setPayingCollaborator(collaborator)}
                onDeductVale={() => setDeductingValeFor(collaborator)}
                packageAppointmentIds={packageAppointmentIds}
              />
            );
          })}
        </div>
      )}

      {payingCollaborator && (
        <CommissionPaymentModal
          open={!!payingCollaborator}
          onClose={() => setPayingCollaborator(null)}
          onPaid={handlePaid}
          collaborator={payingCollaborator}
          pendingCommissions={pendingForPaying}
          outstandingVales={outstandingValesFor(payingCollaborator.id)}
        />
      )}

      {deductingValeFor && (
        <ValeDeductModal
          open={!!deductingValeFor}
          onClose={() => setDeductingValeFor(null)}
          onSaved={refetchVales}
          collaborator={deductingValeFor}
        />
      )}
    </div>
  );
}
