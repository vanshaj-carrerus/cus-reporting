import { NextRequest, NextResponse } from "next/server";
import { findTodaysCheckIn } from "@/lib/attendance";
import { OFFICE_LOCATION, OFFICE_RADIUS_METERS } from "@/lib/config";
import { requireEmployee } from "@/lib/employeeAuth";
import {
  breaksFor,
  getShiftSettings,
  instanceOfAttendance,
  loadEmployeeSchedule,
} from "@/lib/employeeSchedule";
import { haversineDistanceMeters, isValidCoordinate } from "@/lib/geo";
import { classifyPresence } from "@/lib/shifts";
import { Attendance } from "@/models/Attendance";

const MINUTE_MS = 60 * 1000;

// POST /api/presence — the app's location report while an employee is on shift.
// Body { latitude, longitude }. The server decides inside/outside and what it
// means (on a break, overstayed a break, plain outside), keeps the running
// totals, and tells the app the result so both always agree.
async function handlePresence(request: NextRequest) {
  const auth = await requireEmployee(request);
  if ("denied" in auth) return auth.denied;

  let body: { latitude?: number; longitude?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const { latitude, longitude } = body;
  if (!isValidCoordinate(latitude, longitude)) {
    return NextResponse.json(
      { error: "A valid latitude and longitude are required." },
      { status: 400 }
    );
  }

  const now = new Date();
  const record = await findTodaysCheckIn(auth.employee._id, now);
  if (!record || record.checkOutTime) {
    // Nothing to track: not checked in, or already checked out.
    return NextResponse.json({ tracking: false, state: "NOT_IN_SHIFT" });
  }

  const [{ shift, plan }, settings] = await Promise.all([
    loadEmployeeSchedule(auth.employee),
    getShiftSettings(),
  ]);
  const instance = instanceOfAttendance(record);
  const breaks = breaksFor(plan, shift, instance);

  const distance = haversineDistanceMeters(
    latitude as number,
    longitude as number,
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude
  );
  const inside = distance <= OFFICE_RADIUS_METERS;

  const wasOutside = record.lastSeenInside === false;
  const outsideSince = inside
    ? null
    : wasOutside && record.outsideSince
      ? (record.outsideSince as Date)
      : now;

  const { state, overrunSince } = classifyPresence({
    now,
    shift: instance,
    breaks,
    inside,
    outsideSince,
    lastSeenAt: now,
    noSignalMinutes: settings.noSignalMinutes,
    checkedOut: false,
  });

  // Count the time since the previous report toward the totals, but only if the
  // previous report was also outside, and never more than one "no signal"
  // window (a long silence isn't evidence of where they were).
  const previous = record.lastSeenAt as Date | undefined;
  const elapsedMinutes =
    wasOutside && previous
      ? Math.min(now.getTime() - previous.getTime(), settings.noSignalMinutes * MINUTE_MS) /
        MINUTE_MS
      : 0;

  const $set: Record<string, unknown> = { lastSeenAt: now, lastSeenInside: inside };
  const $unset: Record<string, 1> = {};
  const $inc: Record<string, number> = {};
  if (outsideSince) $set.outsideSince = outsideSince;
  else $unset.outsideSince = 1;
  if (state === "OUTSIDE" || state === "BREAK_OVERRUN") $inc.outsideMinutes = elapsedMinutes;
  if (state === "BREAK_OVERRUN") $inc.breakOverrunMinutes = elapsedMinutes;

  await Attendance.updateOne(
    { _id: record._id, checkOutTime: null },
    {
      $set,
      ...(Object.keys($unset).length ? { $unset } : {}),
      ...(Object.keys($inc).length ? { $inc } : {}),
    }
  );

  return NextResponse.json({
    tracking: true,
    inside,
    distanceFromOffice: Math.round(distance),
    state,
    outsideSince: outsideSince?.toISOString() ?? null,
    overrunSince: overrunSince?.toISOString() ?? null,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await handlePresence(request);
  } catch (error) {
    console.error("POST /api/presence failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
