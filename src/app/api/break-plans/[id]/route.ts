import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { parseBreaks, parsePlanName } from "@/lib/breakPlanInput";
import { breaksFitShift } from "@/lib/shifts";
import { isDuplicateKeyError } from "@/lib/mongoErrors";
import { connectToDatabase } from "@/lib/mongodb";
import { BreakPlan, BREAK_PLAN_COLLATION } from "@/models/BreakPlan";
import { Employee } from "@/models/Employee";
import { Shift } from "@/models/Shift";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/break-plans/:id — rename and/or replace the break windows.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid break plan id." }, { status: 400 });
  }

  let body: { name?: unknown; breaks?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const changes: { name?: string; breaks?: { name: string; startTime: string; endTime: string }[] } = {};
  if (body.name !== undefined) {
    const planName = parsePlanName(body.name);
    if ("error" in planName) return NextResponse.json({ error: planName.error }, { status: 400 });
    changes.name = planName.name;
  }
  if (body.breaks !== undefined) {
    const parsed = parseBreaks(body.breaks);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    changes.breaks = parsed.breaks;
  }
  if (!changes.name && !changes.breaks) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const duplicate = () =>
    NextResponse.json(
      { error: `A break plan named "${changes.name}" already exists.` },
      { status: 409 }
    );

  try {
    await connectToDatabase();
    if (!(await BreakPlan.exists({ _id: id }))) {
      return NextResponse.json({ error: "Break plan not found." }, { status: 404 });
    }
    if (changes.name) {
      const clash = await BreakPlan.findOne({ name: changes.name, _id: { $ne: id } }).collation(
        BREAK_PLAN_COLLATION
      );
      if (clash) return duplicate();
    }

    // New breaks must fit inside every shift this plan is used with.
    if (changes.breaks) {
      const shiftIds = await Employee.find({ breakPlan: id, shift: { $ne: null } }).distinct("shift");
      const shifts = await Shift.find({ _id: { $in: shiftIds } }).lean();
      for (const shift of shifts) {
        const problem = breaksFitShift(changes.breaks, shift);
        if (problem) {
          return NextResponse.json(
            { error: `This plan is used on the "${shift.name}" shift. ${problem}` },
            { status: 409 }
          );
        }
      }
    }

    await BreakPlan.updateOne({ _id: id }, { $set: changes }, { runValidators: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (isDuplicateKeyError(error)) return duplicate();
    console.error("PATCH /api/break-plans/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// DELETE /api/break-plans/:id — its employees simply have no scheduled breaks.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid break plan id." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const plan = await BreakPlan.findByIdAndDelete(id);
    if (!plan) return NextResponse.json({ error: "Break plan not found." }, { status: 404 });
    await Employee.updateMany({ breakPlan: id }, { $unset: { breakPlan: 1 } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/break-plans/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
