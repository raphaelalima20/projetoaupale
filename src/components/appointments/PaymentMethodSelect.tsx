import { PAYMENT_METHODS } from "@/lib/constants";
import type { PaymentMethod } from "@/lib/types/database";
import { cn } from "@/lib/utils";

interface PaymentMethodSelectProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  exclude?: PaymentMethod[];
}

export default function PaymentMethodSelect({ value, onChange, exclude }: PaymentMethodSelectProps) {
  const options = exclude ? PAYMENT_METHODS.filter((m) => !exclude.includes(m.value)) : PAYMENT_METHODS;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map(({ value: method, label, icon: Icon }) => (
        <button
          key={method}
          type="button"
          onClick={() => onChange(method)}
          className={cn(
            "flex flex-col items-center gap-2 rounded-btn border px-4 py-4 text-sm transition duration-200",
            value === method
              ? "border-gold bg-gold-dim text-gold-light"
              : "border-border text-textDim hover:border-gold/50 hover:text-text"
          )}
        >
          <Icon size={22} strokeWidth={1.75} />
          {label}
        </button>
      ))}
    </div>
  );
}
