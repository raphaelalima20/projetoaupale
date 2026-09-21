import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export type PeriodPreset = "hoje" | "ontem" | "semana" | "mes" | "personalizado";

interface PeriodFilterProps {
  preset: PeriodPreset;
  customStart: string;
  customEnd: string;
  onChangePreset: (preset: PeriodPreset) => void;
  onChangeCustomStart: (value: string) => void;
  onChangeCustomEnd: (value: string) => void;
  onApply: () => void;
}

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
  { value: "personalizado", label: "Personalizado" },
];

export default function PeriodFilter({
  preset,
  customStart,
  customEnd,
  onChangePreset,
  onChangeCustomStart,
  onChangeCustomEnd,
  onApply,
}: PeriodFilterProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChangePreset(p.value)}
            className={cn(
              "rounded-badge border px-3.5 py-1.5 text-xs font-medium transition duration-200",
              preset === p.value
                ? "border-gold bg-gold-dim text-gold-light"
                : "border-border text-textDim hover:border-gold/40 hover:text-text"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {preset === "personalizado" && (
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="De"
            type="date"
            value={customStart}
            onChange={(e) => onChangeCustomStart(e.target.value)}
          />
          <Input
            label="Até"
            type="date"
            value={customEnd}
            onChange={(e) => onChangeCustomEnd(e.target.value)}
          />
          <Button onClick={onApply}>Filtrar</Button>
        </div>
      )}
    </div>
  );
}
