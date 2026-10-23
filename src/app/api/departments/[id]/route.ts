import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { cleanDepartmentName } from "@/lib/departments";
import { isDuplicateKeyError } from "@/lib/mongoErrors";
import { connectToDatabase } from "@/lib/mongodb";
import {
  Department,
  DEPARTMENT_COLLATION,
  DEPARTMENT_NAME_MAX_LENGTH,
} from "@/models/Department";
import { Employee } from "@/models/Employee";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/departments/:id — rename. Body { name }.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid department id." }, { status: 400 });
  }

  let body: { name?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const name = cleanDepartmentName(body.name);
  if (!name) {
    return NextResponse.json({ error: "Department name is required." }, { status: 400 });
  }
  if (name.length > DEPARTMENT_NAME_MAX_LENGTH) {
    return NextResponse.json(
      { error: `Department name must be at most ${DEPARTMENT_NAME_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const duplicate = () =>
    NextResponse.json({ error: `A department named "${name}" already exists.` }, { status: 409 });

  try {
    await connectToDatabase();

    const clash = await Department.findOne({ name, _id: { $ne: id } }).collation(
      DEPARTMENT_COLLATION
    );
    if (clash) return duplicate();

    const department = await Department.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    );
    if (!department) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }
    return NextResponse.json({
      department: { _id: department._id.toString(), name: department.name },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return duplicate();
    console.error("PATCH /api/departments/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// DELETE /api/departments/:id — removes the department; its employees become
// "Unassigned" (they and their attendance are kept).
export async function DELETE(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid department id." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const department = await Department.findByIdAndDelete(id);
    if (!department) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 });
    }
    await Employee.updateMany({ department: id }, { $unset: { department: 1 } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/departments/[id] failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
