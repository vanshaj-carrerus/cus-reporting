import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { Attendance } from "@/models/Attendance";
import "@/models/Employee"; // registers the Employee model for populate()

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// GET /api/attendance?date=YYYY-MM-DD — defaults to today.
async function handleGet(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const targetDate = dateParam ? new Date(dateParam) : new Date();

  if (Number.isNaN(targetDate.getTime())) {
    return NextResponse.json(
      { error: "Invalid date parameter, expected YYYY-MM-DD." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const records = await Attendance.find({
    checkInTime: { $gte: startOfDay(targetDate), $lte: endOfDay(targetDate) },
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
