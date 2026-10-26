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
import { findLatestApk } from "@/lib/apk";
import { getRelease, isValidVersion, updateNotice } from "@/lib/appVersion";
import { loadOffices } from "@/lib/offices";
import { Employee } from "@/models/Employee";

/** The public /download link on this server, if an APK has been uploaded. */
async function downloadUrl(request: NextRequest): Promise<string | null> {
  if (!(await findLatestApk())) return null;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}/download` : null;
}

// GET /api/auth/me — who is signed in on this device, plus today's attendance
// (null until they've checked in) and their shift schedule: the shift, today's
// concrete break windows, the office area and the alarm rules. The app uses it
// to restore the session and to run the break alarms.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireEmployee(request);
    if ("denied" in auth) return auth.denied;

    const now = new Date();
    // The app says which version it is; builds from before this don't, so it stays unknown.
    const rawVersion = request.headers.get("x-app-version")?.trim() ?? "";
    const appVersion = isValidVersion(rawVersion) ? rawVersion : null;
    const platform = request.headers.get("x-app-platform")?.trim().slice(0, 20) || null;
    // Note that the app was opened (and which version); at most once an hour unless the version changed.
    await Employee.updateOne(
      {
        _id: auth.employee._id,
        $or: [
          { lastActiveAt: { $exists: false } },
          { lastActiveAt: { $lt: new Date(now.getTime() - 60 * 60 * 1000) } },
          ...(appVersion ? [{ appVersion: { $ne: appVersion } }] : []),
        ],
      },
      {
        $set: {
          lastActiveAt: now,
          ...(appVersion ? { appVersion } : {}),
          ...(platform ? { appPlatform: platform } : {}),
        },
      }
    );
    const [attendance, { shift, plan }, settings, offices, release] = await Promise.all([
      findTodaysCheckIn(auth.employee._id, now),
      loadEmployeeSchedule(auth.employee),
      getShiftSettings(),
      loadOffices(),
      getRelease(),
    ]);
    // The shift the employee is checked in to (frozen on their record), or the
    // one that's open for check-in now.
    const instance =
      (attendance && instanceOfAttendance(attendance)) ||
      (shift ? checkInInstance(shift, now, settings) : null);
    return NextResponse.json({
      employee: employeeProfile(auth.employee),
      attendance,
      schedule: scheduleForApp(shift, plan, instance, settings, offices),
      update: updateNotice(release, appVersion, await downloadUrl(request)),
    });
  } catch (error) {
    console.error("GET /api/auth/me failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
