import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import {
  Employee,
  EMPLOYEE_NAME_MAX_LENGTH,
  NAME_COLLATION,
} from "@/models/Employee";
import { Attendance } from "@/models/Attendance";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

type Ctx = { params: Promise<{ id: string }> };

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

// PATCH /api/employees/:id — rename an employee.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid employee id." }, { status: 400 });
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (typeof body.name !== "string") {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  const name = body.name.trim().replace(/\s+/g, " ");
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (name.length > EMPLOYEE_NAME_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Name must be at most ${EMPLOYEE_NAME_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const duplicate = () =>
    NextResponse.json(
      { error: `An employee named "${name}" already exists.` },
      { status: 409 }
    );

  try {
    await connectToDatabase();

    const clash = await Employee.findOne({ name, _id: { $ne: id } }).collation(
      NAME_COLLATION
    );
    if (clash) return duplicate();

    const employee = await Employee.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    );
    if (!employee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({ employee });
  } catch (error) {
    if (isDuplicateKeyError(error)) return duplicate();
    console.error("PATCH /api/employees/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// DELETE /api/employees/:id — remove an employee and their attendance records.
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid employee id." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const employee = await Employee.findByIdAndDelete(id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }
    await Attendance.deleteMany({ userId: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/employees/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
