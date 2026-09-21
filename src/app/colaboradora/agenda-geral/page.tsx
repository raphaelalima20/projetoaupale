"use client";

import AgendaBoard from "@/components/appointments/AgendaBoard";
import { useAuth } from "@/components/auth/AuthProvider";

export default function Page() {
  const { profile } = useAuth();

  if (!profile) return null;

  return (
    <AgendaBoard
      title="Agenda Geral"
      subtitle="Veja os agendamentos de toda a equipe"
      defaultCollaboratorId={profile.id}
      canManageAppointment={(appointment) => appointment.collaborator_id === profile.id}
    />
  );
}
