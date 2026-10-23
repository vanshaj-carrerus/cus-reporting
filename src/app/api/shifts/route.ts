import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/adminAuth";
import { parseShiftBody } from "@/lib/shiftInput";
import { isDuplicateKeyError } from "@/lib/mongoErrors";
import { connectToDatabase } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";
import { Shift, SHIFT_COLLATION } from "@/models/Shift";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

// GET /api/shifts — all shifts with how many employees are on each.
export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  try {
    await connectToDatabase();
    const [shifts, counts] = await Promise.all([
      Shift.find().sort({ startTime: 1, name: 1 }).lean(),
      Employee.aggregate([{ $group: { _id: "$shift", count: { $sum: 1 } } }]),
    ]);
    const countById = new Map(counts.map((c) => [String(c._id), c.count as number]));
    return NextResponse.json({
      shifts: shifts.map((s) => ({
        _id: s._id.toString(),
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        lateGraceMinutes: s.lateGraceMinutes,
        employeeCount: countById.get(s._id.toString()) ?? 0,
      })),
    });
  } catch (error) {
    console.error("GET /api/shifts failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// POST /api/shifts — body { name, startTime, endTime, lateGraceMinutes? } (IST HH:mm).
export async function POST(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = parseShiftBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { name } = parsed.values;

  const duplicate = () =>
    NextResponse.json({ error: `A shift named "${name}" already exists.` }, { status: 409 });

  try {
    await connectToDatabase();
    if (await Shift.findOne({ name }).collation(SHIFT_COLLATION)) return duplicate();

    const shift = await Shift.create(parsed.values);
    return NextResponse.json({ shift: { _id: shift._id.toString() } }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) return duplicate();
    console.error("POST /api/shifts failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
