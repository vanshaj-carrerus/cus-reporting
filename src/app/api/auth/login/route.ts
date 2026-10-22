import { NextRequest, NextResponse } from "next/server";
import { employeeProfile, startEmployeeSession } from "@/lib/employeeAuth";
import { isEmployeeAuthConfigured } from "@/lib/employeeSession";
import { normalizeEmail } from "@/lib/email";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyPassword } from "@/lib/password";
import { clientIp, getLimiter } from "@/lib/rateLimit";
import { Employee } from "@/models/Employee";

const NOT_CONFIGURED =
  "Employee sign-in isn't configured. Set ADMIN_SESSION_SECRET (at least 32 characters) in .env and restart the server.";

// Per client + email, so one employee's typos can't lock out a whole office
// sharing a network address.
const limiter = getLimiter("employee-login", 5, 15 * 60 * 1000);

// POST /api/auth/login — employee signs in with the email + password they set.
export async function POST(request: NextRequest) {
  if (!isEmployeeAuthConfigured()) {
    console.error(NOT_CONFIGURED);
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const email = normalizeEmail(body.email);
  if (!email || typeof body.password !== "string" || !body.password) {
    return NextResponse.json(
      { error: "Enter your email and password." },
      { status: 400 }
    );
  }

  const key = `${clientIp(request)}|${email}`;
  const retryAfter = limiter.retryAfterSeconds(key);
  if (retryAfter > 0) {
    return NextResponse.json(
      {
        error: `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    await connectToDatabase();
    const employee = await Employee.findOne({ email }).select("+passwordHash");

    if (employee && !employee.passwordHash) {
      return NextResponse.json(
        {
          error:
            "You haven't set your password yet. Choose “Set or reset your password” to get a verification code by email.",
          code: "PASSWORD_NOT_SET",
        },
        { status: 409 }
      );
    }

    // Verify even when there's no such employee, so the response time doesn't
    // reveal which emails have accounts.
    const passwordOk = await verifyPassword(body.password, employee?.passwordHash);
    if (!employee || !passwordOk) {
      limiter.recordFailure(key);
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    limiter.clear(key);
    const response = NextResponse.json({ employee: employeeProfile(employee) });
    startEmployeeSession(response, employee._id.toString());
    return response;
  } catch (error) {
    console.error("POST /api/auth/login failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
