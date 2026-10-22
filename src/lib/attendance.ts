import { Attendance } from "@/models/Attendance";
import { istDateKey, istDayRange } from "./time";

/**
 * The employee's accepted check-in for today (IST), if any. A rejected
 * (out-of-location) attempt isn't a check-in, so it doesn't count.
 */
export function findTodaysCheckIn(userId: unknown, now: Date = new Date()) {
  const today = istDayRange(istDateKey(now));
  return Attendance.findOne({
    userId,
    status: { $ne: "OUT_OF_LOCATION" },
    checkInTime: { $gte: today.start, $lt: today.end },
  });
}
