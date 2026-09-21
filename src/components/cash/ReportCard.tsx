import { LucideIcon } from "lucide-react";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface ReportCardProps {
  label: string;
  value: string;
  icon?: LucideIcon;
  valueClassName?: string;
}

export default function ReportCard({ label, value, icon: Icon, valueClassName }: ReportCardProps) {
  return (
    <Card className="flex items-center gap-4">
      {Icon && (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-dim">
          <Icon size={20} className="text-gold" strokeWidth={1.75} />
        </div>
      )}
      <div>
        <p className="text-xs text-textDim">{label}</p>
        <p className={cn("mt-1 font-display text-xl text-text", valueClassName)}>{value}</p>
      </div>
    </Card>
  );
}
