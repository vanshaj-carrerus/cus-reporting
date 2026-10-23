import { Attendance } from "@/models/Attendance";
import { istDateKey, istDayRange } from "./time";
import { CHECKOUT_GRACE_MS } from "./shifts";

/**
 * The employee's accepted check-in that is still current, if any. A rejected
 * (out-of-location) attempt isn't a check-in, so it doesn't count.
 *
 * With a shift, a record stays current until CHECKOUT_GRACE_MS after the shift
 * ends — so a night shift checked in at 22:00 is still found after midnight and
 * can be checked out of. Records from before shifts existed (no shiftEnd) are
 * current for their own IST calendar day, as before.
 */
export function findTodaysCheckIn(userId: unknown, now: Date = new Date()) {
  const today = istDayRange(istDateKey(now));
  return Attendance.findOne({
    userId,
    status: { $ne: "OUT_OF_LOCATION" },
    $or: [
      {
        shiftEnd: { $gt: new Date(now.getTime() - CHECKOUT_GRACE_MS) },
        checkInTime: { $lte: now },
      },
      {
        shiftEnd: { $exists: false },
        checkInTime: { $gte: today.start, $lt: today.end },
      },
    ],
  }).sort({ checkInTime: -1 });
}
