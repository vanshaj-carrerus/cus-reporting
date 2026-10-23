import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { normalizeEmail } from "@/lib/email";
import { resolveScheduleAssignment } from "@/lib/assignments";
import { resolveDepartmentId } from "@/lib/departments";
import { employeeForAdmin } from "@/lib/employeeView";
import { isDuplicateKeyError, isDuplicateOn } from "@/lib/mongoErrors";
import { connectToDatabase } from "@/lib/mongodb";
import "@/models/Department"; // registers the Department model for populate()
import "@/models/Shift"; // registers the Shift model for populate()
import "@/models/BreakPlan"; // registers the BreakPlan model for populate()
import {
  Employee,
  EMPLOYEE_NAME_MAX_LENGTH,
  NAME_COLLATION,
} from "@/models/Employee";
import { Attendance } from "@/models/Attendance";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/employees/:id — change an employee's name, email and/or department
// (departmentId: an id, or null to unassign). Send only
// the fields to change. Changing the email changes what they sign in with, so
// the new address has to be verified again: the employee's password and any
// sessions are cleared, and they set a new password with a code emailed to it.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid employee id." }, { status: 400 });
  }

  let body: {
    name?: unknown;
    email?: unknown;
    departmentId?: unknown;
    shiftId?: unknown;
    breakPlanId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const changes: { name?: string; email?: string } = {};

  if (body.name !== undefined) {
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
    changes.name = name;
  }

  if (body.email !== undefined) {
    const email = normalizeEmail(body.email);
    if (!email) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }
    changes.email = email;
  }

  if (
    changes.name === undefined &&
    changes.email === undefined &&
    body.departmentId === undefined &&
    body.shiftId === undefined &&
    body.breakPlanId === undefined
  ) {
    return NextResponse.json(
      { error: "Send a name, email, department, shift and/or break plan to update." },
      { status: 400 }
    );
  }

  const duplicateName = () =>
    NextResponse.json(
      { error: `An employee named "${changes.name}" already exists.` },
      { status: 409 }
    );
  const duplicateEmail = () =>
    NextResponse.json(
      { error: `An employee with the email ${changes.email} already exists.` },
      { status: 409 }
    );

  try {
    await connectToDatabase();

    const department = await resolveDepartmentId(body.departmentId);
    if ("error" in department) return department.error;

    const existing = await Employee.findById(id).select("email shift breakPlan");
    if (!existing) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }
    const schedule = await resolveScheduleAssignment(body, existing);
    if ("error" in schedule) return schedule.error;

    if (changes.name !== undefined) {
      const clash = await Employee.findOne({
        name: changes.name,
        _id: { $ne: id },
      }).collation(NAME_COLLATION);
      if (clash) return duplicateName();
    }
    if (changes.email !== undefined) {
      const clash = await Employee.exists({
        email: changes.email,
        _id: { $ne: id },
      });
      if (clash) return duplicateEmail();
    }

    const emailChanged = changes.email !== undefined && changes.email !== existing.email;
    const unset: Record<string, 1> = emailChanged
      ? {
          passwordHash: 1,
          passwordSetAt: 1,
          verifyCodeHash: 1,
          verifyCodeExpiresAt: 1,
          verifyCodeSentAt: 1,
          verifyCodeAttempts: 1,
        }
      : {};
    const set: Record<string, unknown> = { ...changes };
    if (department.id) set.department = department.id;
    else if (department.id === null) unset.department = 1;
    if (schedule.shift) set.shift = schedule.shift;
    else if (schedule.shift === null) unset.shift = 1;
    if (schedule.breakPlan) set.breakPlan = schedule.breakPlan;
    else if (schedule.breakPlan === null) unset.breakPlan = 1;

    const employee = await Employee.findByIdAndUpdate(
      id,
      {
        ...(Object.keys(set).length ? { $set: set } : {}),
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
      },
      { new: true, runValidators: true }
    )
      .populate("department", "name")
      .populate("shift", "name startTime endTime")
      .populate("breakPlan", "name");
    if (!employee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({ employee: employeeForAdmin(employee) });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return isDuplicateOn(error, "email") ? duplicateEmail() : duplicateName();
    }
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
