/**
 * The salon operates in Brasília time. Server code (Vercel runs in UTC) must never rely on the
 * host timezone when deciding "today", "tomorrow" or "today's birthdays".
 */
const TZ = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  hourCycle: "h23",
});

/** Today's date in Brasília as YYYY-MM-DD. */
export function todayBRT(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

/** Current hour (0-23) in Brasília. */
export function hourBRT(now: Date = new Date()): number {
  return Number(hourFormatter.format(now));
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** YYYY-MM-DD → DD/MM/YYYY */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "08:30:00" | "08:30" → "08:30" */
export function formatHourMinute(time: string): string {
  return time.slice(0, 5);
}

/** An instant for a wall-clock time in Brasília (Brazil has had no DST since 2019: fixed UTC-3). */
export function brtInstant(dateISO: string, time: string): Date {
  return new Date(`${dateISO}T${formatHourMinute(time)}:00-03:00`);
}
