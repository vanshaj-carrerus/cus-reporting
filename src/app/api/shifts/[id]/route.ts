import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { breaksFitShift } from "@/lib/shifts";
import { parseShiftBody } from "@/lib/shiftInput";
import { isDuplicateKeyError } from "@/lib/mongoErrors";
import { connectToDatabase } from "@/lib/mongodb";
import { BreakPlan } from "@/models/BreakPlan";
import { Employee } from "@/models/Employee";
import { Shift, SHIFT_COLLATION } from "@/models/Shift";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/shifts/:id — change name, times and/or grace. Past attendance keeps
// the shift times it was checked in under; only future check-ins use the new ones.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid shift id." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = parseShiftBody(body, true);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (Object.keys(parsed.values).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const duplicate = () =>
    NextResponse.json(
      { error: `A shift named "${parsed.values.name}" already exists.` },
      { status: 409 }
    );

  try {
    await connectToDatabase();
    const existing = await Shift.findById(id);
    if (!existing) return NextResponse.json({ error: "Shift not found." }, { status: 404 });

    if (parsed.values.name) {
      const clash = await Shift.findOne({ name: parsed.values.name, _id: { $ne: id } }).collation(
        SHIFT_COLLATION
      );
      if (clash) return duplicate();
    }

    // New times must still contain every break of the plans used on this shift.
    const times = {
      startTime: parsed.values.startTime ?? existing.startTime,
      endTime: parsed.values.endTime ?? existing.endTime,
    };
    const planIds = await Employee.find({ shift: id, breakPlan: { $ne: null } }).distinct(
      "breakPlan"
    );
    const plans = await BreakPlan.find({ _id: { $in: planIds } }).lean();
    for (const plan of plans) {
      const problem = breaksFitShift(plan.breaks, times);
      if (problem) {
        return NextResponse.json(
          { error: `Break plan "${plan.name}" is used on this shift. ${problem}` },
          { status: 409 }
        );
      }
    }

    await Shift.updateOne({ _id: id }, { $set: parsed.values }, { runValidators: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isDuplicateKeyError(error)) return duplicate();
    console.error("PATCH /api/shifts/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// DELETE /api/shifts/:id — its employees become shift-less (and use the old
// single late cutoff again). Attendance records are untouched.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid shift id." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const shift = await Shift.findByIdAndDelete(id);
    if (!shift) return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    await Employee.updateMany({ shift: id }, { $unset: { shift: 1 } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/shifts/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
