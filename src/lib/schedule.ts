/** Fallback business hours, used only until salon_settings has loaded. */
export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 19;

/**
 * Hourly grid slots between opening and closing time, inclusive on both ends —
 * opening 08:00 / closing 19:00 produces [8, 9, ..., 18, 19].
 */
export function buildHourSlots(openingTime: string, closingTime: string): number[] {
  const start = hourFromTime(openingTime);
  const end = hourFromTime(closingTime);
  const valid = (hour: number) => Number.isInteger(hour) && hour >= 0 && hour <= 23;
  if (!valid(start) || !valid(end) || end < start) {
    return Array.from(
      { length: BUSINESS_END_HOUR - BUSINESS_START_HOUR + 1 },
      (_, i) => BUSINESS_START_HOUR + i
    );
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export const WEEKDAY_LABELS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const WEEKDAY_LABELS_LONG = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

/** Salon is open Monday (1) through Saturday (6). */
export function isBusinessDay(date: Date): boolean {
  return date.getDay() !== 0;
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getMonday(date: Date): Date {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Monday through Saturday of the week containing `date`. */
export function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isPastDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compare = new Date(date);
  compare.setHours(0, 0, 0, 0);
  return compare < today;
}

/** Extracts the hour (0-23) from a DB time string like "08:30:00" or "08:30". */
export function hourFromTime(time: string): number {
  return Number(time.split(":")[0]);
}

/** Formats a DB time string ("08:30:00") to "08:30" for display. */
export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":");
  return `${h}:${m}`;
}

/** Clamps an appointment's hour into the visible grid range so it always lands on a row. */
export function slotHourForTime(time: string, minHour: number, maxHour: number): number {
  const hour = hourFromTime(time);
  if (hour < minHour) return minHour;
  if (hour > maxHour) return maxHour;
  return hour;
}

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function isOnTheHour(time: string): boolean {
  const minutes = time.split(":")[1];
  return minutes === "00";
}

/** Today, or next Monday if today is Sunday (the salon is closed). */
export function getDefaultBusinessDate(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getDay() === 0 ? addDays(today, 1) : today;
}

/** The next `count` open days (Mon–Sat), starting from `fromDate` (inclusive). */
export function nextBusinessDays(count: number, fromDate: Date = new Date()): Date[] {
  const days: Date[] = [];
  let cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);
  while (days.length < count) {
    if (isBusinessDay(cursor)) days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Short "DD/MM" label, for compact date ranges. */
export function formatDay(date: Date): string {
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}
