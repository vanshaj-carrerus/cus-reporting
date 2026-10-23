import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { attendanceDayFilter } from "@/lib/attendanceDay";
import { istDateKey, parseDateKey } from "@/lib/time";
import { Attendance } from "@/models/Attendance";
import "@/models/Department"; // registers the Department model for populate()
import { Employee } from "@/models/Employee";

// GET /api/attendance?date=YYYY-MM-DD&department=<id|none> — date defaults to
// today; department is optional ("none" = employees with no department).
async function handleGet(request: NextRequest) {
  const dateParam = request.nextUrl.searchParams.get("date");
  const dateKey = dateParam ? parseDateKey(dateParam) : istDateKey();

  if (!dateKey) {
    return NextResponse.json(
      { error: "Invalid date parameter, expected YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const department = request.nextUrl.searchParams.get("department");
  if (department && department !== "none" && !Types.ObjectId.isValid(department)) {
    return NextResponse.json({ error: "Invalid department parameter." }, { status: 400 });
  }

  await connectToDatabase();

  const filter: Record<string, unknown> = { ...attendanceDayFilter(dateKey) };
  if (department) {
    const members = await Employee.find({
      department: department === "none" ? null : department,
    }).distinct("_id");
    filter.userId = { $in: members };
  }

  const records = await Attendance.find(filter)
    .populate({ path: "userId", populate: { path: "department", select: "name" } })
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
