import { NextResponse, type NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "./mongodb";
import {
  EMPLOYEE_COOKIE_OPTIONS,
  EMPLOYEE_SESSION_COOKIE,
  EMPLOYEE_SESSION_MAX_AGE_SECONDS,
  createEmployeeToken,
  verifyEmployeeToken,
} from "./employeeSession";
import "@/models/Department"; // registers the Department model for populate()
import { Employee } from "@/models/Employee";

export const SIGN_IN_REQUIRED = "Please sign in to continue.";

// The Employee model export is loosely typed (see models/Employee.ts), so say
// what a loaded employee looks like here.
type EmployeeRecord = {
  _id: Types.ObjectId;
  name: string;
  email?: string | null;
  // Populated (name only) wherever the profile is sent to the app.
  department?: Types.ObjectId | { name: string } | null;
  passwordSetAt?: Date | null;
  shift?: Types.ObjectId | null;
  breakPlan?: Types.ObjectId | null;
};

/**
 * For route handlers acting on behalf of the signed-in employee. The employee
 * comes from the session cookie only — never from the request body — so nobody
 * can act for someone else. Also fails if the employee has since been deleted.
 */
export async function requireEmployee(
  request: NextRequest
): Promise<{ employee: EmployeeRecord } | { denied: NextResponse }> {
  const denied = () => {
    const response = NextResponse.json({ error: SIGN_IN_REQUIRED }, { status: 401 });
    response.cookies.set(EMPLOYEE_SESSION_COOKIE, "", {
      ...EMPLOYEE_COOKIE_OPTIONS,
      maxAge: 0,
    });
    return { denied: response };
  };

  const token = verifyEmployeeToken(request.cookies.get(EMPLOYEE_SESSION_COOKIE)?.value);
  if (!token || !Types.ObjectId.isValid(token.id)) return denied();

  await connectToDatabase();
  const employee = await Employee.findById(token.id).populate("department", "name");
  if (!employee) return denied();

  // A session only counts if it began after the current password was set. An
  // admin password reset clears passwordSetAt, which ends every older session.
  const passwordSetAt = employee.passwordSetAt?.getTime();
  if (passwordSetAt === undefined || token.issuedAt < passwordSetAt) return denied();

  return { employee };
}

/** Signs `response` in as `employeeId` by attaching the session cookie. */
export function startEmployeeSession(response: NextResponse, employeeId: string) {
  response.cookies.set(EMPLOYEE_SESSION_COOKIE, createEmployeeToken(employeeId), {
    ...EMPLOYEE_COOKIE_OPTIONS,
    maxAge: EMPLOYEE_SESSION_MAX_AGE_SECONDS,
  });
}

/** What the app is allowed to know about the signed-in employee. */
export function employeeProfile(employee: EmployeeRecord) {
  return {
    id: employee._id.toString(),
    name: employee.name,
    email: employee.email ?? null,
    department:
      employee.department && "name" in employee.department ? employee.department.name : null,
  };
}
