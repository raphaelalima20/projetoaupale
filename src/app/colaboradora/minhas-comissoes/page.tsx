"use client";

import { useState } from "react";
import { Gem } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import WeekdayBreakdownGrid from "@/components/commissions/WeekdayBreakdownGrid";
import WeekRangeNavigator from "@/components/commissions/WeekRangeNavigator";
import AccumulativeTable from "@/components/commissions/AccumulativeTable";
import { useCommissions } from "@/lib/hooks/useCommissions";
import { useAuth } from "@/components/auth/AuthProvider";
import { computeWeekdayBreakdown, computeAccumulative } from "@/lib/commissions";
import { getMonday, addDays, toISODate } from "@/lib/schedule";
import { formatCurrency } from "@/lib/utils";

export default function MinhasComissoesPage() {
  const { profile } = useAuth();
  const { commissions, loading } = useCommissions(profile?.id);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));

  const pending = commissions.filter((c) => !c.is_paid);
  const totalPending = pending.reduce((sum, c) => sum + c.commission_value, 0);

  const weekStartISO = toISODate(weekStart);
  const weekEndISO = toISODate(addDays(weekStart, 5));
  const weekCommissions = commissions.filter(
    (c) => c.commission_date >= weekStartISO && c.commission_date <= weekEndISO
  );
  const breakdown = computeWeekdayBreakdown(weekCommissions, weekStart);
  const accumulative = computeAccumulative(weekCommissions);

  function handleChangeWeek(direction: -1 | 1) {
    setWeekStart(addDays(weekStart, direction * 7));
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Minhas Comissões" subtitle="Acompanhe suas comissões" />

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Card
          className="mb-6"
          style={{
            background: `linear-gradient(135deg, ${profile?.avatar_color ?? "#C7A593"}26, transparent)`,
          }}
        >
          <p className="text-xs uppercase tracking-wider text-textDim">
            Total de comissões pendentes
          </p>
          <p className="mt-2 font-display text-3xl text-gold-light">
            {formatCurrency(totalPending)}
          </p>
          <p className="mt-1 text-sm text-textDim">
            {pending.length} atendimento{pending.length === 1 ? "" : "s"}
          </p>
        </Card>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg text-text">Por dia da semana</h2>
        <WeekRangeNavigator weekStart={weekStart} onChangeWeek={handleChangeWeek} />
      </div>

      {loading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="mb-6">
          <WeekdayBreakdownGrid days={breakdown} />
        </div>
      )}

      <h2 className="mb-3 font-display text-lg text-text">Saldo acumulativo</h2>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : weekCommissions.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <Gem size={28} className="text-textDim" strokeWidth={1.5} />
          <p className="text-sm text-textDim">Nenhum atendimento nesta semana</p>
        </Card>
      ) : (
        <AccumulativeTable rows={accumulative} />
      )}
    </div>
  );
}
