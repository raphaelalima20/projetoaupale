import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDay } from "@/lib/schedule";

interface WeekRangeNavigatorProps {
  weekStart: Date;
  onChangeWeek: (direction: -1 | 1) => void;
}

export default function WeekRangeNavigator({ weekStart, onChangeWeek }: WeekRangeNavigatorProps) {
  const weekEnd = addDays(weekStart, 5);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChangeWeek(-1)}
        aria-label="Semana anterior"
        className="rounded-btn border border-border p-1.5 text-textDim transition duration-200 hover:border-gold hover:text-gold"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm text-textDim">
        Semana {formatDay(weekStart)} — {formatDay(weekEnd)}
      </span>
      <button
        onClick={() => onChangeWeek(1)}
        aria-label="Próxima semana"
        className="rounded-btn border border-border p-1.5 text-textDim transition duration-200 hover:border-gold hover:text-gold"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
