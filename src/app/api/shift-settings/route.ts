import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/adminAuth";
import { getShiftSettings } from "@/lib/employeeSchedule";
import { connectToDatabase } from "@/lib/mongodb";
import { ShiftSettings } from "@/models/ShiftSettings";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

const LIMITS = {
  earlyCheckInMinutes: [0, 720],
  noSignalMinutes: [2, 120],
  alarmIntervalMinutes: [1, 30],
  ringsBeforeSilence: [1, 20],
} as const;

// GET /api/shift-settings — the rules shared by every shift.
export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;
  try {
    await connectToDatabase();
    return NextResponse.json({ settings: await getShiftSettings() });
  } catch (error) {
    console.error("GET /api/shift-settings failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// PATCH /api/shift-settings — send any of the fields in LIMITS (whole numbers).
export async function PATCH(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const changes: Record<string, number> = {};
  for (const [key, [min, max]] of Object.entries(LIMITS)) {
    const value = body[key];
    if (value === undefined) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
      return NextResponse.json(
        { error: `${key} must be a whole number from ${min} to ${max}.` },
        { status: 400 }
      );
    }
    changes[key] = value;
  }
  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    await getShiftSettings(); // make sure the document exists
    await ShiftSettings.updateOne({ key: "default" }, { $set: changes });
    return NextResponse.json({ settings: await getShiftSettings() });
  } catch (error) {
    console.error("PATCH /api/shift-settings failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
