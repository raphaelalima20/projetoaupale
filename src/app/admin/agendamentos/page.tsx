"use client";

import AgendaBoard from "@/components/appointments/AgendaBoard";

export default function Page() {
  return (
    <AgendaBoard
      title="Agendamentos"
      subtitle="Gerencie os horários marcados"
      canManageAppointment={() => true}
    />
  );
}
