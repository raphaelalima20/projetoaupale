import { getWeekDays, toISODate } from "./schedule";
import type { Commission } from "./types/database";

export interface WeekdayBreakdown {
  date: Date;
  weekday: number;
  total: number;
  count: number;
}

/** Sums commissions per calendar day for the given Mon–Sat week. */
export function computeWeekdayBreakdown(
  commissions: Commission[],
  weekStart: Date
): WeekdayBreakdown[] {
  return getWeekDays(weekStart).map((day) => {
    const iso = toISODate(day);
    const dayCommissions = commissions.filter((c) => c.commission_date === iso);
    return {
      date: day,
      weekday: day.getDay(),
      total: dayCommissions.reduce((sum, c) => sum + c.commission_value, 0),
      count: dayCommissions.length,
    };
  });
}

export interface CommissionTotals {
  totalCommission: number;
  totalService: number;
  count: number;
}

export function computeTotals(commissions: Commission[]): CommissionTotals {
  return {
    totalCommission: commissions.reduce((sum, c) => sum + c.commission_value, 0),
    totalService: commissions.reduce((sum, c) => sum + c.service_value, 0),
    count: commissions.length,
  };
}

/** The dynamic pending period: from the oldest pending commission's date to today. */
export function computePendingPeriod(pendingCommissions: Commission[]): {
  start: string | null;
  end: string;
} {
  const dates = pendingCommissions.map((c) => c.commission_date).sort();
  return {
    start: dates.length > 0 ? dates[0] : null,
    end: toISODate(new Date()),
  };
}

export function groupByCollaborator(commissions: Commission[]): Map<string, Commission[]> {
  const map = new Map<string, Commission[]>();
  for (const c of commissions) {
    const list = map.get(c.collaborator_id) ?? [];
    list.push(c);
    map.set(c.collaborator_id, list);
  }
  return map;
}

export interface AccumulativeRow extends Commission {
  runningTotal: number;
}

/** Sorts by date and computes a running total — lets a collaborator audit her balance. */
export function computeAccumulative(commissions: Commission[]): AccumulativeRow[] {
  const sorted = [...commissions].sort(
    (a, b) =>
      a.commission_date.localeCompare(b.commission_date) ||
      a.created_at.localeCompare(b.created_at)
  );
  let running = 0;
  return sorted.map((c) => {
    running += c.commission_value;
    return { ...c, runningTotal: running };
  });
}
