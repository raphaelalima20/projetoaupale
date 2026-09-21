import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm text-textDim">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-btn border border-border bg-surface2 px-4 py-2.5 text-sm text-text placeholder:text-textDim/60 outline-none transition duration-200 focus:border-gold",
            error && "border-danger",
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";

export default Input;
