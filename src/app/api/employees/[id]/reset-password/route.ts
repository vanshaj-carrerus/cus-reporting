import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { employeeForAdmin } from "@/lib/employeeView";
import { connectToDatabase } from "@/lib/mongodb";
import { newSetupCode } from "@/lib/setupCode";
import { Employee } from "@/models/Employee";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/employees/:id/reset-password — admin-only. Removes the employee's
// password, signs them out everywhere, and issues a fresh one-time `setupCode`
// (returned once). The employee uses it, with their email, to choose a new
// password. Also the way to re-issue an expired or lost code before first setup.
export async function POST(request: NextRequest, { params }: Ctx) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid employee id." }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const existing = await Employee.findById(id).select("email");
    if (!existing) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }
    if (!existing.email) {
      return NextResponse.json(
        { error: "Add this employee's email first — it's what they sign in with." },
        { status: 400 }
      );
    }

    const { code, fields } = await newSetupCode();
    const employee = await Employee.findByIdAndUpdate(
      id,
      { ...fields, $unset: { passwordHash: 1, passwordSetAt: 1 } },
      { new: true }
    );
    if (!employee) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }
    return NextResponse.json({
      employee: employeeForAdmin(employee),
      setupCode: code,
    });
  } catch (error) {
    console.error("POST /api/employees/[id]/reset-password failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
