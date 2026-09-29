import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import {
  Employee,
  EMPLOYEE_NAME_MAX_LENGTH,
  NAME_COLLATION,
} from "@/models/Employee";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

// GET /api/employees — list all employees (used to populate the check-in dropdown).
export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  try {
    await connectToDatabase();
    const employees = await Employee.find().sort({ name: 1 });
    return NextResponse.json({ employees });
  } catch (error) {
    console.error("GET /api/employees failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

interface CreateEmployeeBody {
  name?: unknown;
}

// POST /api/employees — admin-only creation of a new employee record.
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

  const duplicate = (name: string) =>
    NextResponse.json(
      { error: `An employee named "${name}" already exists.` },
      { status: 409 }
    );

  try {
    await connectToDatabase();

    const existing = await Employee.findOne({ name }).collation(NAME_COLLATION);
    if (existing) {
      return duplicate(existing.name);
    }

    const employee = await Employee.create({ name });
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    // Two requests can race past the check above; the unique index catches it.
    if (isDuplicateKeyError(error)) {
      return duplicate(name);
    }
    console.error("POST /api/employees failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
