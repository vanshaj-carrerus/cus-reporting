import { NextRequest, NextResponse } from "next/server";
import { Attendance } from "@/models/Attendance";
import { findTodaysCheckIn } from "@/lib/attendance";
import { OFFICE_LOCATION, OFFICE_RADIUS_METERS } from "@/lib/config";
import { requireEmployee } from "@/lib/employeeAuth";
import { haversineDistanceMeters, isValidCoordinate } from "@/lib/geo";

interface CheckOutBody {
  latitude?: number;
  longitude?: number;
}

// POST /api/check-out — ends today's attendance. Like check-in, only allowed
// from inside the office geo-fence, and only for the signed-in employee.
async function handleCheckOut(request: NextRequest) {
  const auth = await requireEmployee(request);
  if ("denied" in auth) return auth.denied;

  let body: CheckOutBody;
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

  const record = await findTodaysCheckIn(auth.employee._id);
  if (!record) {
    return NextResponse.json(
      { error: "You haven't checked in today.", code: "NOT_CHECKED_IN" },
      { status: 409 }
    );
  }

  const alreadyOut = () =>
    NextResponse.json(
      {
        error: "You have already checked out today.",
        code: "ALREADY_CHECKED_OUT",
        attendance: record,
      },
      { status: 409 }
    );
  if (record.checkOutTime) return alreadyOut();

  const distance = haversineDistanceMeters(
    latitude as number,
    longitude as number,
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude
  );

  if (distance > OFFICE_RADIUS_METERS) {
    return NextResponse.json(
      {
        error: "You are outside the office geo-fence.",
        distanceFromOffice: Math.round(distance),
        allowedRadius: OFFICE_RADIUS_METERS,
      },
      { status: 403 }
    );
  }

  // Only matches while checkOutTime is still unset, so a double tap (or two
  // devices) can't record two check-outs.
  const attendance = await Attendance.findOneAndUpdate(
    { _id: record._id, checkOutTime: null },
    {
      checkOutTime: new Date(),
      checkOutLatitude: latitude,
      checkOutLongitude: longitude,
      checkOutDistance: distance,
    },
    { new: true }
  );
  if (!attendance) return alreadyOut();

  return NextResponse.json({ success: true, attendance });
}

export async function POST(request: NextRequest) {
  try {
    return await handleCheckOut(request);
  } catch (error) {
    console.error("POST /api/check-out failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
