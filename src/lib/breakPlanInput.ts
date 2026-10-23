import { validateBreakPlan, type BreakTimes } from "./shifts";
import { BREAK_NAME_MAX_LENGTH, BREAK_PLAN_NAME_MAX_LENGTH } from "@/models/BreakPlan";

export const MAX_BREAKS_PER_PLAN = 12;

/** Validates the name of a break plan. */
export function parsePlanName(value: unknown): { error: string } | { name: string } {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name) return { error: "Break plan name is required." };
  if (name.length > BREAK_PLAN_NAME_MAX_LENGTH) {
    return { error: `Break plan name must be at most ${BREAK_PLAN_NAME_MAX_LENGTH} characters.` };
  }
  return { name };
}

/** Validates the list of break windows of a plan (names, IST times, no overlaps). */
export function parseBreaks(value: unknown): { error: string } | { breaks: BreakTimes[] } {
  if (!Array.isArray(value)) return { error: "Breaks must be a list." };
  if (value.length > MAX_BREAKS_PER_PLAN) {
    return { error: `A plan can have at most ${MAX_BREAKS_PER_PLAN} breaks.` };
  }
  const breaks: BreakTimes[] = [];
  for (const raw of value) {
    const item = (raw ?? {}) as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim().replace(/\s+/g, " ") : "";
    if (!name) return { error: "Every break needs a name." };
    if (name.length > BREAK_NAME_MAX_LENGTH) {
      return { error: `Break names must be at most ${BREAK_NAME_MAX_LENGTH} characters.` };
    }
    if (typeof item.startTime !== "string" || typeof item.endTime !== "string") {
      return { error: `"${name}": start and end times are required.` };
    }
    breaks.push({ name, startTime: item.startTime, endTime: item.endTime });
  }
  const problem = validateBreakPlan(breaks);
  if (problem) return { error: problem };
  return { breaks };
}
