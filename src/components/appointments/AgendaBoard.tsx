"use client";

import { useMemo, useState } from "react";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import WeekNavigator from "./WeekNavigator";
import TimeGrid from "./TimeGrid";
import AppointmentCard from "./AppointmentCard";
import AppointmentModal from "./AppointmentModal";
import AppointmentDetailModal from "./AppointmentDetailModal";
import { useAppointmentsByDate } from "@/lib/hooks/useAppointments";
import { useCollaborators } from "@/lib/hooks/useCollaborators";
import { useServices } from "@/lib/hooks/useServices";
import { useCashRegisterId } from "@/lib/hooks/useCashRegisterId";
import { useSalonHours } from "@/lib/hooks/useSalonHours";
import { useScheduleBlocks } from "@/lib/hooks/useScheduleBlocks";
import { buildHourSlots, getDefaultBusinessDate, getMonday, addDays, toISODate } from "@/lib/schedule";
import type { Appointment } from "@/lib/types/database";

interface AgendaBoardProps {
  title: string;
  subtitle: string;
  /** Pre-fills the "Profissional" field when opening a new appointment generically — never locks it. */
  defaultCollaboratorId?: string;
  canManageAppointment: (appointment: Appointment) => boolean;
}

export default function AgendaBoard({
  title,
  subtitle,
  defaultCollaboratorId,
  canManageAppointment,
}: AgendaBoardProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(getDefaultBusinessDate);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(getDefaultBusinessDate()));

  const dateISO = toISODate(selectedDate);
  const { appointments, loading, refetch } = useAppointmentsByDate(dateISO);
  const { collaborators } = useCollaborators();
  const { services } = useServices();
  const { registerId: cashRegisterId } = useCashRegisterId();
  const { openingTime, closingTime } = useSalonHours();
  const hours = useMemo(() => buildHourSlots(openingTime, closingTime), [openingTime, closingTime]);
  const { blocks: scheduleBlocks } = useScheduleBlocks();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalDefaults, setModalDefaults] = useState<{ hour?: number; collaboratorId?: string }>(
    {}
  );
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);

  function handleChangeWeek(direction: -1 | 1) {
    const newWeekStart = addDays(weekStart, direction * 7);
    setWeekStart(newWeekStart);
    setSelectedDate(newWeekStart);
  }

  function openNewModal(hour?: number, collaboratorId?: string) {
    setModalDefaults({ hour, collaboratorId });
    setModalOpen(true);
  }

  function collaboratorFor(appt: Appointment) {
    return collaborators.find((c) => c.id === appt.collaborator_id);
  }

  const sortedAppointments = [...appointments].sort((a, b) =>
    a.appointment_time.localeCompare(b.appointment_time)
  );

  return (
    <div className="animate-fadeIn">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button onClick={() => openNewModal()} className="hidden md:inline-flex">
            <Plus size={16} />
            Novo Agendamento
          </Button>
        }
      />

      <div className="mb-6">
        <WeekNavigator
          weekStart={weekStart}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onChangeWeek={handleChangeWeek}
        />
      </div>

      <div className="hidden md:block">
        {loading ? (
          <Skeleton className="h-96 w-full" />
        ) : collaborators.length === 0 ? (
          <EmptyState />
        ) : (
          <TimeGrid
            hours={hours}
            collaborators={collaborators}
            appointments={appointments}
            scheduleBlocks={scheduleBlocks}
            dateISO={dateISO}
            onCellClick={(hour, collaboratorId) => openNewModal(hour, collaboratorId)}
            onAppointmentClick={setDetailAppointment}
          />
        )}
      </div>

      <div className="flex flex-col gap-3 pb-24 md:hidden">
        {loading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : sortedAppointments.length === 0 ? (
          <EmptyState />
        ) : (
          sortedAppointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              collaborator={collaboratorFor(appt)}
              variant="list"
              onClick={() => setDetailAppointment(appt)}
            />
          ))
        )}

        <button
          onClick={() => openNewModal()}
          aria-label="Novo agendamento"
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-modal transition duration-200 hover:bg-primary-dark"
        >
          <Plus size={26} />
        </button>
      </div>

      <AppointmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={refetch}
        services={services}
        collaborators={collaborators}
        defaultDate={selectedDate}
        defaultHour={modalDefaults.hour}
        defaultCollaboratorId={modalDefaults.collaboratorId ?? defaultCollaboratorId}
        openingTime={openingTime}
        closingTime={closingTime}
        scheduleBlocks={scheduleBlocks}
      />

      <AppointmentDetailModal
        open={!!detailAppointment}
        onClose={() => setDetailAppointment(null)}
        appointment={detailAppointment}
        collaborator={detailAppointment ? collaboratorFor(detailAppointment) : undefined}
        canManage={detailAppointment ? canManageAppointment(detailAppointment) : false}
        onUpdated={refetch}
        cashRegisterId={cashRegisterId}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <CalendarIcon size={28} className="text-textDim" strokeWidth={1.5} />
      <p className="text-sm text-textDim">Nenhum agendamento neste dia</p>
    </Card>
  );
}
