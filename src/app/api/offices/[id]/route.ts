import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { isDuplicateKeyError } from "@/lib/mongoErrors";
import { connectToDatabase } from "@/lib/mongodb";
import { officeJson, parseOfficeBody } from "@/lib/officeInput";
import { Office, OFFICE_COLLATION } from "@/models/Office";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/offices/:id — body { name, latitude, longitude, radiusMeters }.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid office id." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = parseOfficeBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const duplicate = () =>
    NextResponse.json(
      { error: `An office named "${parsed.values.name}" already exists.` },
      { status: 409 }
    );

  try {
    await connectToDatabase();
    const clash = await Office.findOne({ name: parsed.values.name, _id: { $ne: id } }).collation(
      OFFICE_COLLATION
    );
    if (clash) return duplicate();

    const office = await Office.findByIdAndUpdate(id, parsed.values, {
      new: true,
      runValidators: true,
    });
    if (!office) return NextResponse.json({ error: "Office not found." }, { status: 404 });
    return NextResponse.json({ office: officeJson(office) });
  } catch (error) {
    if (isDuplicateKeyError(error)) return duplicate();
    console.error("PATCH /api/offices/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// DELETE /api/offices/:id — employees can no longer check in from there.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid office id." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const office = await Office.findByIdAndDelete(id);
    if (!office) return NextResponse.json({ error: "Office not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/offices/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
