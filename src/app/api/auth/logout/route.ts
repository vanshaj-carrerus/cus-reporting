import { NextResponse } from "next/server";
import {
  EMPLOYEE_COOKIE_OPTIONS,
  EMPLOYEE_SESSION_COOKIE,
} from "@/lib/employeeSession";

// POST /api/auth/logout — ends the employee's session on this device.
export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(EMPLOYEE_SESSION_COOKIE, "", {
    ...EMPLOYEE_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}
