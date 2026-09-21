import Badge from "@/components/ui/Badge";
import type { AppointmentStatus } from "@/lib/types/database";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_TONE: Record<AppointmentStatus, "gold" | "success" | "danger"> = {
  agendado: "gold",
  concluido: "success",
  cancelado: "danger",
};

export default function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
