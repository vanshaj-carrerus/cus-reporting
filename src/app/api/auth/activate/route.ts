import { NextRequest, NextResponse } from "next/server";
import { employeeProfile, startEmployeeSession } from "@/lib/employeeAuth";
import { isEmployeeAuthConfigured } from "@/lib/employeeSession";
import { normalizeEmail } from "@/lib/email";
import { connectToDatabase } from "@/lib/mongodb";
import { hashPassword, passwordProblem } from "@/lib/password";
import { clientIp, getLimiter } from "@/lib/rateLimit";
import {
  normalizeVerificationCode,
  VERIFICATION_CODE_MAX_ATTEMPTS,
  verifyVerificationCode,
} from "@/lib/verificationCode";
import { Employee } from "@/models/Employee";

const NOT_CONFIGURED =
  "Employee sign-in isn't configured. Set ADMIN_SESSION_SECRET (at least 32 characters) in .env and restart the server.";

const WRONG_CODE = "That code isn't right. Check it and try again.";
const NO_CODE = "That code has expired. Ask for a new one.";

// Two buckets: per client + email, and a looser one per client so someone can't
// probe a list of emails.
const perEmailLimiter = getLimiter("employee-activate", 10, 15 * 60 * 1000);
const perClientLimiter = getLimiter("employee-activate-client", 30, 15 * 60 * 1000);

// POST /api/auth/activate — set or reset the password. Needs the email AND the
// 6-digit code emailed to it (see /api/auth/request-code), which proves the
// employee controls that inbox. The code works once. On success every earlier
// session for this account ends, and the employee is signed in.
export async function POST(request: NextRequest) {
  if (!isEmployeeAuthConfigured()) {
    console.error(NOT_CONFIGURED);
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  }

  let body: { email?: unknown; code?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const email = normalizeEmail(body.email);
  if (!email) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const code = normalizeVerificationCode(body.code);
  if (!code) {
    return NextResponse.json(
      { error: "Enter the 6-digit code from the email." },
      { status: 400 }
    );
  }
  const problem = passwordProblem(body.password);
  if (problem) {
    return NextResponse.json({ error: problem }, { status: 400 });
  }
  const password = body.password as string;

  const client = clientIp(request);
  const emailKey = `${client}|${email}`;
  const retryAfter = Math.max(
    perEmailLimiter.retryAfterSeconds(emailKey),
    perClientLimiter.retryAfterSeconds(client)
  );
  if (retryAfter > 0) {
    return NextResponse.json(
      {
        error: `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  const fail = (error: string, status: number) => {
    perEmailLimiter.recordFailure(emailKey);
    perClientLimiter.recordFailure(client);
    return NextResponse.json({ error }, { status });
  };

  try {
    await connectToDatabase();

    const employee = await Employee.findOne({ email }).select(
      "+verifyCodeHash +verifyCodeExpiresAt +verifyCodeAttempts"
    );

    // Check the code even when there's nothing to match, so the response time
    // doesn't reveal which emails are registered.
    const codeOk = await verifyVerificationCode(code, employee?.verifyCodeHash);

    // Unknown email and "no code requested" answer the same way.
    if (!employee || !employee.verifyCodeHash || !employee.verifyCodeExpiresAt) {
      return fail(NO_CODE, 400);
    }
    if (employee.verifyCodeExpiresAt.getTime() < Date.now()) {
      return fail(NO_CODE, 400);
    }

    const attempts = employee.verifyCodeAttempts ?? 0;
    if (attempts >= VERIFICATION_CODE_MAX_ATTEMPTS) {
      return fail("Too many wrong codes. Ask for a new one.", 400);
    }

    if (!codeOk) {
      await Employee.updateOne(
        { _id: employee._id, verifyCodeHash: employee.verifyCodeHash },
        { $inc: { verifyCodeAttempts: 1 } }
      );
      return fail(WRONG_CODE, 400);
    }

    const passwordHash = await hashPassword(password);

    // Atomic: the code is consumed as the password is set, so two simultaneous
    // requests can't both succeed and the code can't be reused.
    const updated = await Employee.findOneAndUpdate(
      { _id: employee._id, verifyCodeHash: employee.verifyCodeHash },
      {
        passwordHash,
        passwordSetAt: new Date(),
        $unset: {
          verifyCodeHash: 1,
          verifyCodeExpiresAt: 1,
          verifyCodeSentAt: 1,
          verifyCodeAttempts: 1,
        },
      },
      { new: true }
    ).populate("department", "name");
    if (!updated) return fail(NO_CODE, 400);

    perEmailLimiter.clear(emailKey);
    await Employee.updateOne({ _id: updated._id }, { $set: { lastActiveAt: new Date() } });
    const response = NextResponse.json({ employee: employeeProfile(updated) });
    startEmployeeSession(response, updated._id.toString());
    return response;
  } catch (error) {
    console.error("POST /api/auth/activate failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
