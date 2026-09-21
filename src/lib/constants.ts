import { Smartphone, Banknote, CreditCard, FileText, LucideIcon } from "lucide-react";
import type { PaymentMethod } from "@/lib/types/database";

export interface PaymentMethodOption {
  value: PaymentMethod;
  label: string;
  icon: LucideIcon;
}

export const PAYMENT_METHODS: PaymentMethodOption[] = [
  { value: "pix", label: "Pix", icon: Smartphone },
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "credito", label: "Crédito", icon: CreditCard },
  { value: "debito", label: "Débito", icon: CreditCard },
  { value: "promissoria", label: "Promissória", icon: FileText },
];

/** Theme colors per payment method, used for dots/badges/breakdown cards in the cash module. */
export const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
  pix: "#2FA4B5",
  dinheiro: "#5FA57A",
  credito: "#B8964E",
  debito: "#5B8DB8",
  promissoria: "#D98B4A",
};

export const CASH_CATEGORIES = [
  { value: "manual", label: "Manual" },
  { value: "outro", label: "Outro" },
];

export const AVATAR_COLORS = [
  { value: "#C7A593", label: "Nude" },
  { value: "#B8964E", label: "Dourado" },
  { value: "#D6708A", label: "Rosa" },
  { value: "#9C6BB0", label: "Lilás" },
  { value: "#5FA57A", label: "Verde" },
  { value: "#5B8DB8", label: "Azul" },
  { value: "#D98B4A", label: "Laranja" },
];

export const SPECIALTY_OPTIONS = [
  "Cabeleireira",
  "Manicure",
  "Nail Designer",
  "Lash Designer",
  "Esteticista",
  "Escovista",
  "Colorista",
  "Barbeiro(a)",
  "Maquiador(a)",
  "Design de Sobrancelha",
];

export const SERVICE_PACKAGE_PERIODS = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "evento", label: "Evento" },
];
