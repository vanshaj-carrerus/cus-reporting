import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";
import { Attendance } from "@/models/Attendance";
import { istDateKey, istDayRange, istTimeOfDay } from "@/lib/time";
import { haversineDistanceMeters } from "@/lib/geo";
import {
  OFFICE_LOCATION,
  OFFICE_RADIUS_METERS,
  SHIFT_CUTOFF_HOUR,
  SHIFT_CUTOFF_MINUTE,
} from "@/lib/config";

interface CheckInBody {
  userId?: string;
  latitude?: number;
  longitude?: number;
}

function isValidCoordinate(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

function isLateArrival(now: Date): boolean {
  const cutoff = istTimeOfDay(now, SHIFT_CUTOFF_HOUR, SHIFT_CUTOFF_MINUTE);
  return now > cutoff;
}

async function handleCheckIn(request: NextRequest) {
  let body: CheckInBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const { userId, latitude, longitude } = body;

  if (!userId || typeof userId !== "string" || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json(
      { error: "A valid userId is required." },
      { status: 400 }
    );
  }

  if (!isValidCoordinate(latitude, longitude)) {
    return NextResponse.json(
      { error: "A valid latitude and longitude are required." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const employee = await Employee.findById(userId);
  if (!employee) {
    return NextResponse.json({ error: "This employee no longer exists. Please contact your admin." }, { status: 404 });
  }

  const now = new Date();

  const today = istDayRange(istDateKey(now));

  const todaysRecords = await Attendance.find({
    userId,
    checkInTime: { $gte: today.start, $lt: today.end },
  }).sort({ checkInTime: -1 });

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

  const distance = haversineDistanceMeters(
    latitude as number,
    longitude as number,
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude
  );

  const atOffice = distance <= OFFICE_RADIUS_METERS;

  const status = !atOffice
    ? "OUT_OF_LOCATION"
    : isLateArrival(now)
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
        allowedRadius: OFFICE_RADIUS_METERS,
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
