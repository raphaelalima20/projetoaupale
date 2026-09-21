"use client";

import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import WeekNavigator from "@/components/appointments/WeekNavigator";
import AppointmentCard from "@/components/appointments/AppointmentCard";
import AppointmentDetailModal from "@/components/appointments/AppointmentDetailModal";
import { useAppointmentsByDate } from "@/lib/hooks/useAppointments";
import { useCashRegisterId } from "@/lib/hooks/useCashRegisterId";
import { useAuth } from "@/components/auth/AuthProvider";
import { getDefaultBusinessDate, getMonday, addDays, toISODate } from "@/lib/schedule";
import type { Appointment } from "@/lib/types/database";

export default function MinhaAgendaPage() {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(getDefaultBusinessDate);
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(getDefaultBusinessDate()));

  const dateISO = toISODate(selectedDate);
  const { appointments, loading, refetch } = useAppointmentsByDate(dateISO);
  const { registerId: cashRegisterId } = useCashRegisterId();
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);

  const myAppointments = appointments
    .filter((a) => a.collaborator_id === profile?.id)
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

  function handleChangeWeek(direction: -1 | 1) {
    const newWeekStart = addDays(weekStart, direction * 7);
    setWeekStart(newWeekStart);
    setSelectedDate(newWeekStart);
  }

  return (
    <div className="animate-fadeIn">
      <PageHeader title="Minha Agenda" subtitle="Seus atendimentos agendados" />

      <div className="mb-6">
        <WeekNavigator
          weekStart={weekStart}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onChangeWeek={handleChangeWeek}
        />
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          <>
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </>
        ) : myAppointments.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 py-16 text-center">
            <CalendarIcon size={28} className="text-textDim" strokeWidth={1.5} />
            <p className="text-sm text-textDim">Nenhum agendamento neste dia</p>
          </Card>
        ) : (
          myAppointments.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appointment={appt}
              variant="list"
              onClick={() => setDetailAppointment(appt)}
            />
          ))
        )}
      </div>

      <AppointmentDetailModal
        open={!!detailAppointment}
        onClose={() => setDetailAppointment(null)}
        appointment={detailAppointment}
        collaborator={profile ?? undefined}
        canManage
        onUpdated={refetch}
        cashRegisterId={cashRegisterId}
      />
    </div>
  );
}
