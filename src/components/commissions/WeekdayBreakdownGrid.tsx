import { WEEKDAY_LABELS_SHORT } from "@/lib/schedule";
import { formatCurrency, cn } from "@/lib/utils";
import type { WeekdayBreakdown } from "@/lib/commissions";

export default function WeekdayBreakdownGrid({ days }: { days: WeekdayBreakdown[] }) {
  return (
    <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
      {days.map((day) => (
        <div
          key={day.date.toISOString()}
          className="flex flex-col items-center gap-1 rounded-btn border border-border bg-surface2 px-1 py-2.5 text-center"
        >
          <span className="text-[10px] uppercase tracking-wide text-textDim">
            {WEEKDAY_LABELS_SHORT[day.weekday]}
          </span>
          <span
            className={cn(
              "text-xs font-medium sm:text-sm",
              day.total > 0 ? "text-gold" : "text-textDim/50"
            )}
          >
            {formatCurrency(day.total)}
          </span>
          <span className="text-[10px] text-textDim">{day.count}</span>
        </div>
      ))}
    </div>
  );
}
