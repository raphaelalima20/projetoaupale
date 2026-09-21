import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}

export default function Toggle({ checked, onChange, disabled, label, description }: ToggleProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", disabled && "opacity-50")}>
      {(label || description) && (
        <div>
          {label && <p className="text-sm text-text">{label}</p>}
          {description && <p className="text-xs text-textDim">{description}</p>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition duration-200",
          checked ? "border-primary bg-primary" : "border-border bg-surface2",
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full transition duration-200",
            checked ? "left-[22px] bg-white" : "left-0.5 bg-textDim"
          )}
        />
      </button>
    </div>
  );
}
