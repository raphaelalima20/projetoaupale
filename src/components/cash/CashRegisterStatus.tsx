import { formatTime, cn } from "@/lib/utils";
import type { CashStatus } from "@/lib/types/database";

interface CashRegisterStatusProps {
  status: CashStatus;
  time?: string | null;
}

export default function CashRegisterStatus({ status, time }: CashRegisterStatusProps) {
  const isOpen = status === "aberto";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-badge border px-3 py-1 text-xs font-medium",
        isOpen
          ? "border-success/40 bg-success/15 text-success"
          : "border-danger/40 bg-danger/15 text-danger"
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: isOpen ? "#4CAF50" : "#E57373" }}
      />
      {isOpen ? "Aberto" : "Fechado"}
      {time && <span className="text-textDim">· {formatTime(time)}</span>}
    </span>
  );
}
