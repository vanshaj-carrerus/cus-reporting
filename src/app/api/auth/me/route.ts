import { NextRequest, NextResponse } from "next/server";
import { findTodaysCheckIn } from "@/lib/attendance";
import { employeeProfile, requireEmployee } from "@/lib/employeeAuth";

// GET /api/auth/me — who is signed in on this device, plus today's attendance
// (null until they've checked in). The app uses it to restore the session.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireEmployee(request);
    if ("denied" in auth) return auth.denied;

    const attendance = await findTodaysCheckIn(auth.employee._id);
    return NextResponse.json({
      employee: employeeProfile(auth.employee),
      attendance,
    });
  } catch (error) {
    console.error("GET /api/auth/me failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
