import { NextResponse } from "next/server";
import { Types, type Model } from "mongoose";

/**
 * Reads an optional reference id from a request body. `undefined` = not sent
 * (leave as is), `null` or "" = clear it, otherwise it must be the id of an
 * existing document. Call after connecting to the database.
 */
export async function resolveRefId(
  model: Model<any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  value: unknown,
  label: string
): Promise<{ id: string | null | undefined } | { error: NextResponse }> {
  if (value === undefined) return { id: undefined };
  if (value === null || value === "") return { id: null };

  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) {
    return { error: NextResponse.json({ error: `Invalid ${label}.` }, { status: 400 }) };
  }
  if (!(await model.exists({ _id: value }))) {
    return {
      error: NextResponse.json({ error: `That ${label} no longer exists.` }, { status: 400 }),
    };
  }
  return { id: value };
}
