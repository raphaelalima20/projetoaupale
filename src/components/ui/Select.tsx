import { SelectHTMLAttributes, forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm text-textDim">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={cn(
              "w-full appearance-none rounded-btn border border-border bg-surface2 px-4 py-2.5 pr-10 text-sm text-text outline-none transition duration-200 focus:border-gold",
              error && "border-danger",
              className
            )}
            {...props}
          >
            {children}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-textDim"
          />
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  }
);
Select.displayName = "Select";

export default Select;
