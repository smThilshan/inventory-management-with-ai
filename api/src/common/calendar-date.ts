/**
 * Calendar dates (YYYY-MM-DD) for invoices. Stored as Postgres DATE, handled
 * in JS as a Date at UTC midnight, so no server-timezone shift can move them.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Today's date in the given IANA time zone, e.g. "2026-01-02" in Dubai at 2026-01-01T21:00Z. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** "2026-03-15" → Date at 2026-03-15T00:00:00.000Z. */
export function parseCalendarDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date at UTC midnight → "2026-03-15". */
export function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Calendar arithmetic in UTC: month and year boundaries, leap years, no DST. */
export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}
