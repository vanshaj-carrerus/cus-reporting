import { parseHHmm } from "./shifts";
import { DEFAULT_LATE_GRACE_MINUTES, SHIFT_NAME_MAX_LENGTH } from "@/models/Shift";

export interface ShiftValues {
  name?: string;
  startTime?: string;
  endTime?: string;
  lateGraceMinutes?: number;
}

/**
 * Validates a shift request body. With `partial`, only the fields that were
 * sent are checked (for PATCH). Returns the clean values or an error message.
 */
export function parseShiftBody(
  body: Record<string, unknown>,
  partial = false
): { error: string } | { values: ShiftValues } {
  const values: ShiftValues = {};

  if (!partial || body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
    if (!name) return { error: "Shift name is required." };
    if (name.length > SHIFT_NAME_MAX_LENGTH) {
      return { error: `Shift name must be at most ${SHIFT_NAME_MAX_LENGTH} characters.` };
    }
    values.name = name;
  }
  for (const key of ["startTime", "endTime"] as const) {
    if (!partial || body[key] !== undefined) {
      if (parseHHmm(body[key]) === null) {
        return { error: `${key === "startTime" ? "Start" : "End"} time must be a valid HH:mm (IST).` };
      }
      values[key] = body[key] as string;
    }
  }
  if (!partial || body.lateGraceMinutes !== undefined) {
    const grace = body.lateGraceMinutes ?? DEFAULT_LATE_GRACE_MINUTES;
    if (typeof grace !== "number" || !Number.isInteger(grace) || grace < 0 || grace > 240) {
      return { error: "Late grace must be a whole number of minutes between 0 and 240." };
    }
    values.lateGraceMinutes = grace;
  }
  return { values };
}
