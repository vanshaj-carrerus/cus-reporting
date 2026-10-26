import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Attendance } from "@/models/Attendance";
import { requireEmployee } from "@/lib/employeeAuth";
import { istDateKey, istDayRange, istTimeOfDay } from "@/lib/time";
import {
  checkInInstance,
  getShiftSettings,
  loadEmployeeSchedule,
} from "@/lib/employeeSchedule";
import { isLateForShift } from "@/lib/shifts";
import { isValidCoordinate } from "@/lib/geo";
import { loadOffices, matchOffice } from "@/lib/offices";
import { SHIFT_CUTOFF_HOUR, SHIFT_CUTOFF_MINUTE } from "@/lib/config";

interface CheckInBody {
  latitude?: number;
  longitude?: number;
}

function isLateArrival(now: Date): boolean {
  const cutoff = istTimeOfDay(now, SHIFT_CUTOFF_HOUR, SHIFT_CUTOFF_MINUTE);
  return now > cutoff;
}

async function handleCheckIn(request: NextRequest) {
  // Who is checking in comes from the signed-in session, never from the body.
  const auth = await requireEmployee(request);
  if ("denied" in auth) return auth.denied;
  const userId = auth.employee._id;

  let body: CheckInBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { latitude, longitude } = body;

  if (!isValidCoordinate(latitude, longitude)) {
    return NextResponse.json(
      { error: "A valid latitude and longitude are required." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const now = new Date();

  // With a shift, the "day" is the shift instance (a night shift spans midnight).
  // Without one, it's the IST calendar day, as before shifts existed.
  const { shift } = await loadEmployeeSchedule(auth.employee);
  const instance = shift
    ? checkInInstance(shift, now, await getShiftSettings())
    : null;

  if (shift && !instance) {
    return NextResponse.json(
      {
        error: `Your ${shift.name} shift (${shift.startTime}–${shift.endTime} IST) isn't open for check-in right now.`,
        code: "SHIFT_CLOSED",
      },
      { status: 422 }
    );
  }

  const today = istDayRange(istDateKey(now));
  const todaysRecords = await Attendance.find(
    instance
      ? { userId, shiftDate: instance.dateKey }
      : { userId, checkInTime: { $gte: today.start, $lt: today.end } }
  ).sort({ checkInTime: -1 });

  // Only an accepted check-in counts as "already checked in". A rejected
  // (out-of-location) attempt must not block a retry from the office.
  const existing = todaysRecords.find((r) => r.status !== "OUT_OF_LOCATION");
  const rejected = todaysRecords.find((r) => r.status === "OUT_OF_LOCATION");

  // Prevent duplicate check-ins for the same employee on the same day.
  if (existing) {
    return NextResponse.json(
      {
        error: "You have already checked in today.",
        attendance: existing,
      },
      { status: 409 }
    );
  }

  // Inside any of the admin's office areas counts; otherwise it's measured to the closest one.
  const match = matchOffice(await loadOffices(), latitude as number, longitude as number);
  const distance = match.distance;
  const atOffice = match.inside;

  const status = !atOffice
    ? "OUT_OF_LOCATION"
    : (instance && shift
          ? isLateForShift(instance, shift.lateGraceMinutes, now)
          : isLateArrival(now))
      ? "LATE"
      : "ON_TIME";

  // Keep a single row per day: a new attempt (rejected or accepted) replaces
  // the earlier rejected one instead of piling up duplicates.
  const fields = {
    checkInTime: now,
    latitude,
    longitude,
    status,
    distanceFromOffice: distance,
    ...(instance && shift
      ? {
          shiftDate: instance.dateKey,
          shiftName: shift.name,
          shiftStart: instance.start,
          shiftEnd: instance.end,
        }
      : {}),
  };
  let attendance;
  if (rejected) {
    rejected.set(fields);
    attendance = await rejected.save();
  } else {
    attendance = await Attendance.create({ userId, ...fields });
  }

  if (!atOffice) {
    // Logged for HR visibility, but the check-in itself is rejected.
    return NextResponse.json(
      {
        error: "You are outside the office geo-fence.",
        distanceFromOffice: Math.round(distance),
        allowedRadius: match.office.radius,
        nearestOffice: match.office.name,
        attendance,
      },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, attendance }, { status: 201 });
}

export async function POST(request: NextRequest) {
  try {
    return await handleCheckIn(request);
  } catch (error) {
    console.error("POST /api/check-in failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
