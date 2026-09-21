export const RECEIVABLE_STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  parcial: "Parcial",
  pago: "Pago",
};

export function receivableStatusTone(status: string): "danger" | "gold" | "success" | "neutral" {
  if (status === "pendente") return "danger";
  if (status === "parcial") return "gold";
  if (status === "pago") return "success";
  return "neutral";
}
