import { Fragment } from "react";
import AppointmentCard from "./AppointmentCard";
import CollaboratorAvatar from "@/components/ui/CollaboratorAvatar";
import SpecialtyText from "@/components/collaborators/SpecialtyText";
import type { Appointment, Profile, ScheduleBlock } from "@/lib/types/database";
import { hourLabel, isOnTheHour, slotHourForTime } from "@/lib/schedule";
import { getBlockForDate, isDateFullyBlocked, isHourBlocked } from "@/lib/scheduleBlocks";
import { cn } from "@/lib/utils";

interface TimeGridProps {
  hours: number[];
  collaborators: Profile[];
  appointments: Appointment[];
  scheduleBlocks: ScheduleBlock[];
  dateISO: string;
  onCellClick: (hour: number, collaboratorId: string) => void;
  onAppointmentClick: (appointment: Appointment) => void;
}

const STRIPE_BG =
  "repeating-linear-gradient(45deg, rgba(138,133,121,0.08), rgba(138,133,121,0.08) 6px, transparent 6px, transparent 12px)";

export default function TimeGrid({
  hours,
  collaborators,
  appointments,
  scheduleBlocks,
  dateISO,
  onCellClick,
  onAppointmentClick,
}: TimeGridProps) {
  const minHour = hours[0] ?? 0;
  const maxHour = hours[hours.length - 1] ?? 23;

  function appointmentsFor(hour: number, collaboratorId: string) {
    return appointments.filter(
      (a) =>
        a.collaborator_id === collaboratorId &&
        slotHourForTime(a.appointment_time, minHour, maxHour) === hour
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border">
      <div
        className="grid"
        style={{
          gridTemplateColumns: `70px repeat(${collaborators.length}, minmax(160px, 1fr))`,
          minWidth: 70 + collaborators.length * 160,
        }}
      >
        <div className="sticky left-0 z-10 border-b border-r border-border bg-surface" />
        {collaborators.map((c) => {
          const block = getBlockForDate(scheduleBlocks, c.id, dateISO);
          const fullDayBlocked = isDateFullyBlocked(block, dateISO, minHour, maxHour);
          return (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-2 border-b border-border bg-surface p-3",
                fullDayBlocked && "opacity-50"
              )}
              style={fullDayBlocked ? { backgroundImage: STRIPE_BG } : undefined}
            >
              <CollaboratorAvatar
                name={c.full_name}
                color={c.avatar_color}
                photoUrl={c.photo_url}
                size={28}
              />
              <div className="min-w-0">
                <span className="block truncate text-sm text-text">{c.full_name}</span>
                {fullDayBlocked ? (
                  <p className="truncate text-[11px] text-danger">Indisponível</p>
                ) : (
                  c.specialty && (
                    <SpecialtyText
                      specialty={c.specialty}
                      className="block text-[11px] text-textDim"
                    />
                  )
                )}
              </div>
            </div>
          );
        })}

        {hours.map((hour) => (
          <Fragment key={hour}>
            <div className="flex items-start justify-center border-b border-r border-border bg-surface p-2 text-xs text-textDim">
              {hourLabel(hour)}
            </div>
            {collaborators.map((c) => {
              const cellAppointments = appointmentsFor(hour, c.id);
              const empty = cellAppointments.length === 0;
              const block = getBlockForDate(scheduleBlocks, c.id, dateISO);
              const blocked = isHourBlocked(block, hour, dateISO);
              const clickable = empty && !blocked;
              return (
                <div
                  key={c.id}
                  onClick={() => clickable && onCellClick(hour, c.id)}
                  className={cn(
                    "min-h-[68px] border-b border-r border-border p-1.5 transition duration-200",
                    clickable && "cursor-pointer hover:bg-surface2",
                    blocked && "opacity-50"
                  )}
                  style={blocked ? { backgroundImage: STRIPE_BG } : undefined}
                >
                  {blocked && empty ? (
                    <p className="pt-1 text-center text-[11px] text-danger">Indisponível</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {cellAppointments.map((appt) => (
                        <AppointmentCard
                          key={appt.id}
                          appointment={appt}
                          collaborator={c}
                          onClick={() => onAppointmentClick(appt)}
                          variant="grid"
                          showTimeBadge={!isOnTheHour(appt.appointment_time)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
