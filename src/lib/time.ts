// All attendance times are Indian Standard Time (Asia/Kolkata, UTC+05:30).
// IST has no daylight saving, so a fixed offset is exact. Timestamps stay in
// UTC in MongoDB; only day boundaries, the late cutoff and display use IST.
// This never depends on the server's or the browser's own timezone.

export const IST_TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of the IST calendar day containing `date`. */
export function istDateKey(date: Date = new Date()): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Parses "YYYY-MM-DD"; returns null if it isn't a real calendar date. */
export function parseDateKey(key: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== key
    ? null
    : key;
}

/** Start (inclusive) and end (exclusive) instants of an IST day. */
export function istDayRange(key: string): { start: Date; end: Date } {
  const start = new Date(new Date(`${key}T00:00:00Z`).getTime() - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** The instant of hour:minute IST on the same IST day as `date`. */
export function istTimeOfDay(date: Date, hour: number, minute: number): Date {
  const { start } = istDayRange(istDateKey(date));
  return new Date(start.getTime() + (hour * 60 + minute) * 60 * 1000);
}

export function formatIstTime(value: Date | string): string {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: IST_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatIstDateTime(value: Date | string): string {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function formatIstDate(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
