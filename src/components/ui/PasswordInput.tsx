import { InputHTMLAttributes, forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm text-textDim">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            className={cn(
              "w-full rounded-btn border border-border bg-surface2 px-4 py-2.5 pr-11 text-sm text-text placeholder:text-textDim/60 outline-none transition duration-200 focus:border-gold",
              error && "border-danger",
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-textDim transition duration-200 hover:text-gold"
          >
            {visible ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

export default PasswordInput;
