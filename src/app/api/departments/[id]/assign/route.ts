import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { resolveRefId } from "@/lib/refs";
import { connectToDatabase } from "@/lib/mongodb";
import { BreakPlan } from "@/models/BreakPlan";
import { Department } from "@/models/Department";
import { Employee } from "@/models/Employee";
import { Shift } from "@/models/Shift";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/departments/:id/assign — body { shiftId?, breakPlanId? }. Gives every
// employee of the department that shift and/or break plan (null clears it).
export async function POST(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid department id." }, { status: 400 });
  }

  let body: { shiftId?: unknown; breakPlanId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    if (!(await Department.exists({ _id: id }))) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }
    const shift = await resolveRefId(Shift, body.shiftId, "shift");
    if ("error" in shift) return shift.error;
    const plan = await resolveRefId(BreakPlan, body.breakPlanId, "break plan");
    if ("error" in plan) return plan.error;
    if (shift.id === undefined && plan.id === undefined) {
      return NextResponse.json({ error: "Choose a shift and/or break plan." }, { status: 400 });
    }

    const $set: Record<string, string> = {};
    const $unset: Record<string, 1> = {};
    if (shift.id) $set.shift = shift.id;
    else if (shift.id === null) $unset.shift = 1;
    if (plan.id) $set.breakPlan = plan.id;
    else if (plan.id === null) $unset.breakPlan = 1;

    const result = await Employee.updateMany(
      { department: id },
      {
        ...(Object.keys($set).length ? { $set } : {}),
        ...(Object.keys($unset).length ? { $unset } : {}),
      }
    );
    return NextResponse.json({ updated: result.modifiedCount });
  } catch (error) {
    console.error("POST /api/departments/[id]/assign failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
