import { NextRequest, NextResponse } from "next/server";
import { findTodaysCheckIn } from "@/lib/attendance";
import { employeeProfile, requireEmployee } from "@/lib/employeeAuth";
import {
  checkInInstance,
  getShiftSettings,
  instanceOfAttendance,
  loadEmployeeSchedule,
  scheduleForApp,
} from "@/lib/employeeSchedule";

// GET /api/auth/me — who is signed in on this device, plus today's attendance
// (null until they've checked in) and their shift schedule: the shift, today's
// concrete break windows, the office area and the alarm rules. The app uses it
// to restore the session and to run the break alarms.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireEmployee(request);
    if ("denied" in auth) return auth.denied;

    const now = new Date();
    const [attendance, { shift, plan }, settings] = await Promise.all([
      findTodaysCheckIn(auth.employee._id, now),
      loadEmployeeSchedule(auth.employee),
      getShiftSettings(),
    ]);
    // The shift the employee is checked in to (frozen on their record), or the
    // one that's open for check-in now.
    const instance =
      (attendance && instanceOfAttendance(attendance)) ||
      (shift ? checkInInstance(shift, now, settings) : null);
    return NextResponse.json({
      employee: employeeProfile(auth.employee),
      attendance,
      schedule: scheduleForApp(shift, plan, instance, settings),
    });
  } catch (error) {
    console.error("GET /api/auth/me failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
