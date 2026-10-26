import { NextResponse } from "next/server";
import { BreakPlan } from "@/models/BreakPlan";
import { Shift } from "@/models/Shift";
import { resolveRefId } from "./refs";

type Id = string | null | undefined;

/**
 * Reads `shiftId` / `breakPlanId` from a request body (undefined = leave as is,
 * null = clear) and checks that they exist. Call after connecting.
 */
export async function resolveScheduleAssignment(
  body: { shiftId?: unknown; breakPlanId?: unknown }
): Promise<{ shift: Id; breakPlan: Id } | { error: NextResponse }> {
  const shift = await resolveRefId(Shift, body.shiftId, "shift");
  if ("error" in shift) return shift;
  const plan = await resolveRefId(BreakPlan, body.breakPlanId, "break plan");
  if ("error" in plan) return plan;

  return { shift: shift.id, breakPlan: plan.id };
}
