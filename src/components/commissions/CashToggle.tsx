import { AlertTriangle } from "lucide-react";
import Toggle from "@/components/ui/Toggle";

interface CashToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  cashRegisterOpen: boolean;
}

export default function CashToggle({ checked, onChange, cashRegisterOpen }: CashToggleProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-btn border border-border p-3">
        <Toggle
          checked={checked}
          onChange={onChange}
          label="Incidir no caixa"
          description="Se ativado, essa saída será registrada no fluxo de caixa do dia"
        />
      </div>
      {checked && !cashRegisterOpen && (
        <div className="flex items-center gap-2 rounded-btn border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
          <AlertTriangle size={15} className="shrink-0" />
          Abra o caixa antes de fazer este pagamento.
        </div>
      )}
    </div>
  );
}
