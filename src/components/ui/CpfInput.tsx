import Input from "./Input";

interface CpfInputProps {
  value: string;
  onChange: (digits: string) => void;
  label?: string;
  required?: boolean;
  id?: string;
}

export function formatCPF(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

export default function CpfInput({
  value,
  onChange,
  label = "CPF",
  required,
  id = "cpf",
}: CpfInputProps) {
  return (
    <Input
      id={id}
      label={label}
      type="text"
      inputMode="numeric"
      value={formatCPF(value)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
      placeholder="000.000.000-00"
      required={required}
    />
  );
}
