import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { Department } from "@/models/Department";

/** Collapses inner whitespace so "Human  Resources" and "Human Resources" match. */
export function cleanDepartmentName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().replace(/\s+/g, " ") || null;
}

/**
 * Reads an optional `departmentId` from a request body. `undefined` means "not
 * sent" (leave as is), `null` or "" means "no department", otherwise it must be
 * the id of an existing department. Call after connecting to the database.
 */
export async function resolveDepartmentId(
  value: unknown
): Promise<{ id: string | null | undefined } | { error: NextResponse }> {
  if (value === undefined) return { id: undefined };
  if (value === null || value === "") return { id: null };

  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    return {
      error: NextResponse.json({ error: "Invalid department." }, { status: 400 }),
    };
  }
  if (!(await Department.exists({ _id: value }))) {
    return {
      error: NextResponse.json({ error: "That department no longer exists." }, { status: 400 }),
    };
  }
  return { id: value };
}
