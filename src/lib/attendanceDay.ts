import { istDayRange } from "./time";

/**
 * Mongo filter for "attendance of this IST day". Records made under a shift
 * belong to the date their shift started (so a night shift checked in after
 * midnight still counts for the evening it began); older records have no
 * shift and fall back to the calendar day of the check-in.
 */
export function attendanceDayFilter(dateKey: string) {
  const { start, end } = istDayRange(dateKey);
  return {
    $or: [
      { shiftDate: dateKey },
      { shiftDate: { $exists: false }, checkInTime: { $gte: start, $lt: end } },
    ],
  };
}
