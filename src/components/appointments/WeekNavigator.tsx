import { ChevronLeft, ChevronRight } from "lucide-react";
import { getWeekDays, isSameDay, WEEKDAY_LABELS_SHORT } from "@/lib/schedule";
import { cn } from "@/lib/utils";

interface WeekNavigatorProps {
  weekStart: Date;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onChangeWeek: (direction: -1 | 1) => void;
}

export default function WeekNavigator({
  weekStart,
  selectedDate,
  onSelectDate,
  onChangeWeek,
}: WeekNavigatorProps) {
  const days = getWeekDays(weekStart);
  const today = new Date();

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChangeWeek(-1)}
        aria-label="Semana anterior"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn border border-border text-textDim transition duration-200 hover:border-gold hover:text-gold"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex min-w-0 flex-1 gap-2.5 overflow-x-auto pb-1">
        {days.map((day) => {
          const selected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex min-w-[70px] flex-1 shrink-0 flex-col items-center justify-center gap-1 rounded-btn border py-3",
                "transition duration-200",
                selected
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-surface text-textDim hover:border-gold/40 hover:text-text"
              )}
            >
              <span className="text-[14px] font-semibold uppercase tracking-wide sm:text-[15px]">
                {WEEKDAY_LABELS_SHORT[day.getDay()]}
              </span>
              <span className="text-[13px]">
                {String(day.getDate()).padStart(2, "0")}/{String(day.getMonth() + 1).padStart(2, "0")}
              </span>
              {isToday && (
                <span
                  className={cn("mt-0.5 h-1 w-1 rounded-full", selected ? "bg-primary-fg" : "bg-gold")}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => onChangeWeek(1)}
        aria-label="Próxima semana"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn border border-border text-textDim transition duration-200 hover:border-gold hover:text-gold"
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
