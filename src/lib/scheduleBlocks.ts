import { hourFromTime, formatDay, parseISODate } from "./schedule";
import { formatDate } from "./utils";
import type { ScheduleBlock } from "./types/database";

/** The block covering a collaborator on a given date, if any (a collaborator has at most one). */
export function getBlockForDate(
  blocks: ScheduleBlock[],
  collaboratorId: string,
  dateISO: string
): ScheduleBlock | null {
  return (
    blocks.find(
      (b) =>
        b.collaborator_id === collaboratorId && b.start_date <= dateISO && b.end_date >= dateISO
    ) ?? null
  );
}

/** True for rows created before the start_time/end_time migration was applied. */
function isLegacyBlock(block: ScheduleBlock): boolean {
  return block.end_time === undefined;
}

/**
 * An end_time of null/empty, or "00:00", both mean "she doesn't come back this day" — 00:00
 * is before the salon even opens, so treating it literally (blocked only until midnight, i.e.
 * never) would make the block a no-op. Either way it collapses to "blocked all day".
 */
function isWholeDayEndTime(endTime: string | null | undefined): boolean {
  return !endTime || endTime.startsWith("00:00");
}

/**
 * Whether `hour` on `dateISO` falls inside the block's unavailable window.
 *
 * New model: every day strictly before `end_date` is blocked all day; on `end_date` itself,
 * the collaborator is blocked until `end_time` (or all day, if `end_time` is null/empty/00:00).
 * Legacy rows (no end_time column yet) fall back to the old uniform block_type behavior.
 */
export function isHourBlocked(block: ScheduleBlock | null, hour: number, dateISO: string): boolean {
  if (!block) return false;

  if (isLegacyBlock(block)) {
    if (block.block_type === "morning") return hour < 13;
    if (block.block_type === "afternoon") return hour >= 13;
    return true; // full_day (or any other legacy value): blocked all day, every day
  }

  if (dateISO < block.end_date) return true;
  if (isWholeDayEndTime(block.end_time)) return true;
  return hour < hourFromTime(block.end_time as string);
}

/** Whether every bookable hour of `dateISO` is blocked — drives the grid's whole-column treatment. */
export function isDateFullyBlocked(
  block: ScheduleBlock | null,
  dateISO: string,
  minHour: number,
  maxHour: number
): boolean {
  if (!block) return false;
  for (let hour = minHour; hour <= maxHour; hour++) {
    if (!isHourBlocked(block, hour, dateISO)) return false;
  }
  return true;
}

/** Human-readable period summary for a block, for the "Fluxo de Agenda" listing. */
export function formatBlockPeriod(block: ScheduleBlock): string {
  const sameDay = block.start_date === block.end_date;

  if (isLegacyBlock(block)) {
    const typeLabel =
      block.block_type === "morning"
        ? "Manhã (até 13h)"
        : block.block_type === "afternoon"
          ? "Tarde (a partir de 13h)"
          : "Dia inteiro";
    return sameDay
      ? `${formatDate(parseISODate(block.start_date))} — ${typeLabel}`
      : `${formatDate(parseISODate(block.start_date))} a ${formatDate(parseISODate(block.end_date))} — ${typeLabel}`;
  }

  const startLabel = formatDay(parseISODate(block.start_date));
  const endLabel = formatDay(parseISODate(block.end_date));

  if (isWholeDayEndTime(block.end_time)) {
    return sameDay ? `${startLabel} — Dia inteiro` : `${startLabel} a ${endLabel} — Dias inteiros`;
  }
  const endTimeLabel = (block.end_time as string).slice(0, 5);

  if (sameDay) {
    const periodLabel = endTimeLabel <= "14:00" ? "Manhã" : "Período";
    return `${startLabel} — ${periodLabel} (disponível a partir de ${endTimeLabel})`;
  }

  return `${startLabel} a ${endLabel} — Disponível a partir de ${endTimeLabel} no dia ${endLabel.slice(0, 2)}`;
}
