import { NextRequest, NextResponse } from "next/server";
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

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

// GET /api/employees — list all employees, with their email and whether they've
// set a password yet (passwordSetAt). The password hash is never selected.
export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  try {
    await connectToDatabase();
    const employees = await Employee.find()
      .sort({ name: 1 })
      .populate("department", "name")
      .populate("shift", "name startTime endTime")
      .populate("breakPlan", "name");
    return NextResponse.json({ employees: employees.map(employeeForAdmin) });
  } catch (error) {
    console.error("GET /api/employees failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

interface CreateEmployeeBody {
  name?: unknown;
  email?: unknown;
  departmentId?: unknown;
  shiftId?: unknown;
  breakPlanId?: unknown;
}

// POST /api/employees — admin-only creation of a new employee. The email is the
// employee's login. Nothing is handed to the employee: they open the app, ask for
// a verification code to be emailed to that address, and set their own password.
export async function POST(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  let body: CreateEmployeeBody;
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

  // Collapse inner whitespace so "Asha  Rao" and "Asha Rao" are the same name.
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

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json(
      { error: "A valid email address is required." },
      { status: 400 }
    );
  }

  const duplicateName = (name: string) =>
    NextResponse.json(
      { error: `An employee named "${name}" already exists.` },
      { status: 409 }
    );
  const duplicateEmail = () =>
    NextResponse.json(
      { error: `An employee with the email ${email} already exists.` },
      { status: 409 }
    );

  try {
    await connectToDatabase();

    const department = await resolveDepartmentId(body.departmentId);
    if ("error" in department) return department.error;
    const schedule = await resolveScheduleAssignment(body);
    if ("error" in schedule) return schedule.error;

    const existing = await Employee.findOne({ name }).collation(NAME_COLLATION);
    if (existing) {
      return duplicateName(existing.name);
    }
    if (await Employee.exists({ email })) {
      return duplicateEmail();
    }

    const employee = await Employee.create({
      name,
      email,
      ...(department.id ? { department: department.id } : {}),
      ...(schedule.shift ? { shift: schedule.shift } : {}),
      ...(schedule.breakPlan ? { breakPlan: schedule.breakPlan } : {}),
    });
    await employee.populate([
      { path: "department", select: "name" },
      { path: "shift", select: "name startTime endTime" },
      { path: "breakPlan", select: "name" },
    ]);
    return NextResponse.json({ employee: employeeForAdmin(employee) }, { status: 201 });
  } catch (error) {
    // Two requests can race past the checks above; the unique indexes catch it.
    if (isDuplicateKeyError(error)) {
      return isDuplicateOn(error, "email") ? duplicateEmail() : duplicateName(name);
    }
    console.error("POST /api/employees failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
