import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  total: number;
  current: number;
}

export default function StepIndicator({ total, current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div
          key={step}
          className={cn(
            "h-1.5 flex-1 rounded-full transition duration-200",
            step <= current ? "bg-primary" : "bg-surface2"
          )}
        />
      ))}
    </div>
  );
}
