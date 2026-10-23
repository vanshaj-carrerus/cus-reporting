import { NextResponse } from "next/server";
import { BreakPlan } from "@/models/BreakPlan";
import { Shift } from "@/models/Shift";
import { resolveRefId } from "./refs";
import { breaksFitShift } from "./shifts";

type Id = string | null | undefined;

/**
 * Reads `shiftId` / `breakPlanId` from a request body (undefined = leave as is,
 * null = clear) and checks that, together with what the employee already has,
 * every break of the plan falls inside the shift. Call after connecting.
 */
export async function resolveScheduleAssignment(
  body: { shiftId?: unknown; breakPlanId?: unknown },
  current: { shift?: unknown; breakPlan?: unknown } = {}
): Promise<{ shift: Id; breakPlan: Id } | { error: NextResponse }> {
  const shift = await resolveRefId(Shift, body.shiftId, "shift");
  if ("error" in shift) return shift;
  const plan = await resolveRefId(BreakPlan, body.breakPlanId, "break plan");
  if ("error" in plan) return plan;

  const problem = await scheduleProblem(
    shift.id === undefined ? (current.shift ? String(current.shift) : null) : shift.id,
    plan.id === undefined ? (current.breakPlan ? String(current.breakPlan) : null) : plan.id
  );
  if (problem) {
    return { error: NextResponse.json({ error: problem }, { status: 400 }) };
  }
  return { shift: shift.id, breakPlan: plan.id };
}

/** An error message if the plan's breaks don't fit the shift, else null. */
export async function scheduleProblem(
  shiftId: string | null,
  planId: string | null
): Promise<string | null> {
  if (!shiftId || !planId) return null;
  const [shift, plan] = await Promise.all([
    Shift.findById(shiftId).lean(),
    BreakPlan.findById(planId).lean(),
  ]);
  if (!shift || !plan) return null;
  return breaksFitShift(plan.breaks, shift);
}
