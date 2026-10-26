// Shift and break scheduling. Pure functions only (no database), so the rules
// can be tested in isolation: see scripts/test-shifts.ts.
//
// Everything is Indian Standard Time. Shifts and breaks are stored as "HH:mm"
// strings; they only become real instants here, through istDayRange(), so the
// server's and the phone's own timezone never matter.

import { istDateKey, istDayRange } from "./time";

const MINUTE_MS = 60 * 1000;
const DAY_MINUTES = 24 * 60;

/** After a shift ends, an employee can still check out for this long. */
export const CHECKOUT_GRACE_MS = 6 * 60 * MINUTE_MS;

export interface ShiftTimes {
  startTime: string;
  endTime: string;
}

export interface BreakTimes {
  name: string;
  startTime: string;
  endTime: string;
}

export interface Window {
  start: Date;
  end: Date;
}

export interface ShiftInstance extends Window {
  /** IST date (YYYY-MM-DD) the shift started on. */
  dateKey: string;
}

export interface BreakInstance extends Window {
  name: string;
}

/** "HH:mm" (24h) -> minutes since midnight, or null if it isn't a valid time. */
export function parseHHmm(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Minutes from `start` to `end` on a 24h clock; end <= start wraps past midnight. */
function spanMinutes(startMin: number, endMin: number): number {
  const span = (endMin - startMin + DAY_MINUTES) % DAY_MINUTES;
  return span === 0 ? DAY_MINUTES : span;
}

/** The IST calendar date `days` after (or before, if negative) `dateKey`. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The concrete window of the shift that starts on IST date `dateKey`. */
export function shiftWindow(shift: ShiftTimes, dateKey: string): ShiftInstance {
  const startMin = parseHHmm(shift.startTime);
  const endMin = parseHHmm(shift.endTime);
  if (startMin === null || endMin === null) {
    throw new Error(`Invalid shift times ${shift.startTime}-${shift.endTime}`);
  }
  const start = new Date(istDayRange(dateKey).start.getTime() + startMin * MINUTE_MS);
  const end = new Date(start.getTime() + spanMinutes(startMin, endMin) * MINUTE_MS);
  return { dateKey, start, end };
}

/**
 * Which instance of the shift is relevant at `now`: the one whose window,
 * widened by `earlyMinutes` before its start, contains `now`. Looks at the
 * shifts that started yesterday, today and tomorrow (IST), so a night shift is
 * still found after midnight. Returns null if none is open. If two overlap
 * (only possible with very long shifts) the most recently started wins.
 */
export function resolveShiftInstance(
  shift: ShiftTimes,
  now: Date,
  earlyMinutes = 0
): ShiftInstance | null {
  const today = istDateKey(now);
  const open: ShiftInstance[] = [];
  for (const offset of [-1, 0, 1]) {
    const instance = shiftWindow(shift, addDaysToDateKey(today, offset));
    const opensAt = instance.start.getTime() - earlyMinutes * MINUTE_MS;
    if (now.getTime() >= opensAt && now.getTime() < instance.end.getTime()) {
      open.push(instance);
    }
  }
  if (open.length === 0) return null;
  // Prefer an instance that has already started; among those, the latest.
  const started = open.filter((i) => i.start.getTime() <= now.getTime());
  const pool = started.length > 0 ? started : open;
  return pool.reduce((a, b) => (b.start > a.start ? b : a));
}

/**
 * Places the plan's break windows on a concrete shift instance. A break time
 * earlier on the clock than the shift's start belongs to the next calendar day
 * (e.g. 02:00 in a 22:00-06:00 shift). Breaks that don't fall inside the shift
 * are dropped. Result is sorted by start.
 */
export function resolveBreaks(
  breaks: BreakTimes[],
  shift: ShiftTimes,
  instance: ShiftInstance
): BreakInstance[] {
  const shiftStartMin = parseHHmm(shift.startTime) as number;
  const result: BreakInstance[] = [];
  for (const b of breaks) {
    const startMin = parseHHmm(b.startTime);
    const endMin = parseHHmm(b.endTime);
    if (startMin === null || endMin === null) continue;
    const offset = (startMin - shiftStartMin + DAY_MINUTES) % DAY_MINUTES;
    const start = new Date(instance.start.getTime() + offset * MINUTE_MS);
    const end = new Date(start.getTime() + spanMinutes(startMin, endMin) * MINUTE_MS);
    if (end.getTime() > instance.end.getTime()) continue;
    result.push({ name: b.name, start, end });
  }
  return result.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Checks a break plan's own rules: valid times and a non-empty window. Breaks
 * may overlap each other and may sit anywhere on the clock. Returns an error
 * message, or null if fine.
 */
export function validateBreakPlan(breaks: BreakTimes[]): string | null {
  for (const b of breaks) {
    const startMin = parseHHmm(b.startTime);
    const endMin = parseHHmm(b.endTime);
    if (startMin === null || endMin === null) {
      return `"${b.name}": times must be valid HH:mm.`;
    }
    if (startMin === endMin) {
      return `"${b.name}": start and end can't be the same time.`;
    }
  }
  return null;
}

/** Whether a check-in at `now` is late for this shift instance. */
export function isLateForShift(instance: ShiftInstance, graceMinutes: number, now: Date): boolean {
  return now.getTime() > instance.start.getTime() + graceMinutes * MINUTE_MS;
}

export type PresenceState =
  | "NOT_IN_SHIFT"
  | "INSIDE"
  | "ON_BREAK"
  | "OUTSIDE"
  | "BREAK_OVERRUN"
  | "NO_SIGNAL";

export interface PresenceInput {
  now: Date;
  /** The shift instance the employee checked in to (null for legacy records). */
  shift: Window | null;
  breaks: Window[];
  /** True = inside the office area, false = outside, null = never reported. */
  inside: boolean | null;
  /** When they were last known to have left; null while inside. */
  outsideSince: Date | null;
  lastSeenAt: Date | null;
  noSignalMinutes: number;
  checkedOut: boolean;
}

/**
 * The single place the "outside the office" rules live (the app mirrors it):
 *  - outside during a break window: ON_BREAK, nobody is alerted;
 *  - still outside after a break window ended: BREAK_OVERRUN (the alarm case);
 *  - outside at any other time during the shift: OUTSIDE;
 *  - nothing heard for noSignalMinutes: NO_SIGNAL, not "inside".
 */
export function classifyPresence(input: PresenceInput): {
  state: PresenceState;
  /** For BREAK_OVERRUN: when the break they overstayed ended. */
  overrunSince: Date | null;
} {
  const { now, shift, breaks, inside, outsideSince, lastSeenAt, noSignalMinutes, checkedOut } = input;
  const t = now.getTime();
  const none = { overrunSince: null };

  if (checkedOut) return { state: "NOT_IN_SHIFT", ...none };
  if (shift && (t < shift.start.getTime() || t >= shift.end.getTime())) {
    return { state: "NOT_IN_SHIFT", ...none };
  }
  if (!lastSeenAt || t - lastSeenAt.getTime() > noSignalMinutes * MINUTE_MS) {
    return { state: "NO_SIGNAL", ...none };
  }
  if (inside !== false) return { state: "INSIDE", ...none };

  if (breaks.some((b) => t >= b.start.getTime() && t < b.end.getTime())) {
    return { state: "ON_BREAK", ...none };
  }
  // They left no later than the moment a break ended, and that break is over
  // now: they didn't come back when it finished.
  const left = outsideSince?.getTime() ?? t;
  const overstayed = breaks
    .filter((b) => b.end.getTime() <= t && left <= b.end.getTime())
    .sort((a, b) => b.end.getTime() - a.end.getTime())[0];
  if (overstayed) return { state: "BREAK_OVERRUN", overrunSince: overstayed.end };
  return { state: "OUTSIDE", ...none };
}
