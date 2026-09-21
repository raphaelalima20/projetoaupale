import Input from "./Input";

interface PhoneInputProps {
  value: string;
  onChange: (digits: string) => void;
  label?: string;
  required?: boolean;
  id?: string;
}

function maskPhone(digits: string): string {
  const d = digits.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

export default function PhoneInput({
  value,
  onChange,
  label = "Telefone",
  required,
  id = "phone",
}: PhoneInputProps) {
  return (
    <Input
      id={id}
      label={label}
      type="tel"
      inputMode="numeric"
      value={maskPhone(value)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
      placeholder="(11) 9 1234-5678"
      required={required}
    />
  );
}
