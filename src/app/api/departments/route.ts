import { NextRequest, NextResponse } from "next/server";
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

// GET /api/departments — all departments with how many employees each has.
export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  try {
    await connectToDatabase();
    const [departments, counts] = await Promise.all([
      Department.find().sort({ name: 1 }).collation(DEPARTMENT_COLLATION).lean(),
      Employee.aggregate([{ $group: { _id: "$department", count: { $sum: 1 } } }]),
    ]);
    const countById = new Map(counts.map((c) => [String(c._id), c.count as number]));
    return NextResponse.json({
      departments: departments.map((d) => ({
        _id: d._id.toString(),
        name: d.name,
        employeeCount: countById.get(d._id.toString()) ?? 0,
      })),
    });
  } catch (error) {
    console.error("GET /api/departments failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// POST /api/departments — body { name }.
export async function POST(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

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

  const duplicate = (existing: string) =>
    NextResponse.json(
      { error: `A department named "${existing}" already exists.` },
      { status: 409 }
    );

  try {
    await connectToDatabase();
    const existing = await Department.findOne({ name }).collation(DEPARTMENT_COLLATION);
    if (existing) return duplicate(existing.name);

    const department = await Department.create({ name });
    return NextResponse.json(
      { department: { _id: department._id.toString(), name: department.name, employeeCount: 0 } },
      { status: 201 }
    );
  } catch (error) {
    // Two requests can race past the check above; the unique index catches it.
    if (isDuplicateKeyError(error)) return duplicate(name);
    console.error("POST /api/departments failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
