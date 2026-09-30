import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { istDateKey, istDayRange, parseDateKey } from "@/lib/time";
import { Attendance } from "@/models/Attendance";
import "@/models/Employee"; // registers the Employee model for populate()

// GET /api/attendance?date=YYYY-MM-DD — defaults to today.
async function handleGet(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const dateKey = dateParam ? parseDateKey(dateParam) : istDateKey();

  if (!dateKey) {
    return NextResponse.json(
      { error: "Invalid date parameter, expected YYYY-MM-DD." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const records = await Attendance.find({
    checkInTime: { $gte: istDayRange(dateKey).start, $lt: istDayRange(dateKey).end },
  })
    .populate("userId")
    .sort({ checkInTime: -1 });

  return NextResponse.json({ records });
}

export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  try {
    return await handleGet(request);
  } catch (error) {
    console.error("GET /api/attendance failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
