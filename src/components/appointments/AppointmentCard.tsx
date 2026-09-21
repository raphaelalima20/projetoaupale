import { Package } from "lucide-react";
import AppointmentStatusBadge from "./StatusBadge";
import Badge from "@/components/ui/Badge";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import type { Appointment, Profile } from "@/lib/types/database";
import { formatTimeLabel } from "@/lib/schedule";
import { formatCurrency } from "@/lib/utils";

interface AppointmentCardProps {
  appointment: Appointment;
  collaborator?: Profile;
  onClick: () => void;
  variant?: "grid" | "list";
  showTimeBadge?: boolean;
}

export default function AppointmentCard({
  appointment,
  collaborator,
  onClick,
  variant = "grid",
  showTimeBadge = false,
}: AppointmentCardProps) {
  const color = collaborator?.avatar_color || "#C7A593";
  const concludedSessionValue =
    appointment.status === "concluido" && appointment.is_package_session
      ? appointment.package_session_value
      : null;

  if (variant === "list") {
    return (
      <button
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left transition duration-200 hover:border-gold/50"
        style={{ borderLeftWidth: 3, borderLeftColor: color }}
      >
        <span className="w-14 shrink-0 font-display text-base text-text">
          {formatTimeLabel(appointment.appointment_time)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{appointment.client_name}</p>
          <p className="truncate text-xs text-textDim">{appointment.service_name}</p>
          {collaborator && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <CollaboratorAvatar
                name={collaborator.full_name}
                color={collaborator.avatar_color}
                photoUrl={collaborator.photo_url}
                size={18}
              />
              <span className="text-xs text-textDim">{collaborator.full_name}</span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <AppointmentStatusBadge status={appointment.status} />
          {appointment.is_package_session && (
            <Badge tone="info" className="gap-1">
              <Package size={10} />
              Pacote
            </Badge>
          )}
          {concludedSessionValue !== null && (
            <span className="text-[11px] text-textDim">
              Sessão: {formatCurrency(concludedSessionValue)}
            </span>
          )}
          {appointment.status === "concluido" && appointment.payment_method === "promissoria" && (
            <Badge tone="orange">A prazo</Badge>
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-1 rounded-md border border-border/60 bg-surface2 px-2 py-1.5 text-left transition duration-200 hover:border-gold/50"
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-medium text-text">{appointment.client_name}</span>
        {showTimeBadge && (
          <span className="shrink-0 rounded-badge bg-gold-dim px-1.5 py-0.5 text-[10px] text-gold-light">
            {formatTimeLabel(appointment.appointment_time)}
          </span>
        )}
      </div>
      <span className="truncate text-[11px] text-textDim">{appointment.service_name}</span>
      <div className="flex flex-wrap items-center gap-1">
        <AppointmentStatusBadge status={appointment.status} />
        {appointment.is_package_session && (
          <span className="inline-flex items-center gap-0.5 rounded-badge border border-info/30 bg-info/15 px-1.5 py-0.5 text-[9px] text-info">
            <Package size={9} />
            Pacote
          </span>
        )}
        {concludedSessionValue !== null && (
          <span className="text-[9px] text-textDim">
            Sessão: {formatCurrency(concludedSessionValue)}
          </span>
        )}
        {appointment.status === "concluido" && appointment.payment_method === "promissoria" && (
          <span className="rounded-badge border border-warn/30 bg-warn/15 px-1.5 py-0.5 text-[9px] text-warn">
            A prazo
          </span>
        )}
      </div>
    </button>
  );
}
