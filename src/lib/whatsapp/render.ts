export interface TemplateVars {
  nome?: string;
  servico?: string;
  profissional?: string;
  data?: string;
  hora?: string;
}

export const TEMPLATE_VARIABLES: { key: keyof TemplateVars; label: string }[] = [
  { key: "nome", label: "Nome do cliente" },
  { key: "servico", label: "Serviço" },
  { key: "profissional", label: "Profissional" },
  { key: "data", label: "Data" },
  { key: "hora", label: "Hora" },
];

/** Replaces {{variable}} placeholders. Unknown placeholders become empty — never sent raw to a customer. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => vars[key as keyof TemplateVars] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** Digits with the Brazilian country code (55) as WhatsApp providers expect. */
export function toWhatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Local numbers (DDD + 8/9 digits) get the country code; anything longer is assumed complete.
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

/** Sample data for the live preview in the template editor. */
export const SAMPLE_VARS: Required<TemplateVars> = {
  nome: "Maria",
  servico: "Escova modelada",
  profissional: "Ana",
  data: "25/09/2026",
  hora: "14:00",
};
