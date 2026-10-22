import { NextRequest, NextResponse } from "next/server";
import { employeeProfile, startEmployeeSession } from "@/lib/employeeAuth";
import { isEmployeeAuthConfigured } from "@/lib/employeeSession";
import { normalizeEmail } from "@/lib/email";
import { connectToDatabase } from "@/lib/mongodb";
import { hashPassword, passwordProblem } from "@/lib/password";
import { clientIp, getLimiter } from "@/lib/rateLimit";
import { normalizeSetupCode, verifySetupCode } from "@/lib/setupCode";
import { Employee } from "@/models/Employee";

const NOT_CONFIGURED =
  "Employee sign-in isn't configured. Set ADMIN_SESSION_SECRET (at least 32 characters) in .env and restart the server.";

// Two buckets: per client + email, and a looser one per client so someone can't
// probe a list of emails to see which ones the admin registered.
const perEmailLimiter = getLimiter("employee-activate", 5, 15 * 60 * 1000);
const perClientLimiter = getLimiter("employee-activate-client", 20, 15 * 60 * 1000);

// POST /api/auth/activate — first-time setup (or after an admin reset): the
// employee chooses their password. Needs the email AND the one-time setup code
// the admin gave them, so nobody can claim an account just by knowing its email.
// The code works once; afterwards they sign in.
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
    return NextResponse.json(
      { error: "Enter the email address your admin registered for you." },
      { status: 400 }
    );
  }
  const code = normalizeSetupCode(body.code);
  if (!code) {
    return NextResponse.json(
      { error: "Enter the setup code your admin gave you (8 characters)." },
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

  try {
    await connectToDatabase();

    const pending = await Employee.findOne({ email }).select(
      "+passwordHash +setupCodeHash +setupCodeExpiresAt"
    );

    if (pending?.passwordHash) {
      perEmailLimiter.recordFailure(emailKey);
      perClientLimiter.recordFailure(client);
      return NextResponse.json(
        {
          error: "This account already has a password. Sign in instead.",
          code: "ALREADY_ACTIVE",
        },
        { status: 409 }
      );
    }

    // Verify even when there's nothing to match, so the response time doesn't
    // reveal which emails are registered. Unknown email, no code issued and a
    // wrong code all look the same.
    const codeOk = await verifySetupCode(code, pending?.setupCodeHash);
    if (!pending || !codeOk) {
      perEmailLimiter.recordFailure(emailKey);
      perClientLimiter.recordFailure(client);
      return NextResponse.json(
        {
          error:
            "That email and setup code don't match. Check them, or ask your admin for a new code.",
        },
        { status: 404 }
      );
    }
    if (!pending.setupCodeExpiresAt || pending.setupCodeExpiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "This setup code has expired. Ask your admin for a new one." },
        { status: 410 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Atomic: the code is consumed as the password is set, so two simultaneous
    // requests can't both succeed, and the code can't be reused.
    const employee = await Employee.findOneAndUpdate(
      { _id: pending._id, passwordHash: null, setupCodeHash: pending.setupCodeHash },
      {
        passwordHash,
        passwordSetAt: new Date(),
        $unset: { setupCodeHash: 1, setupCodeExpiresAt: 1 },
      },
      { new: true }
    );
    if (!employee) {
      return NextResponse.json(
        { error: "This account was just set up. Try signing in." },
        { status: 409 }
      );
    }

    perEmailLimiter.clear(emailKey);
    const response = NextResponse.json(
      { employee: employeeProfile(employee) },
      { status: 201 }
    );
    startEmployeeSession(response, employee._id.toString());
    return response;
  } catch (error) {
    console.error("POST /api/auth/activate failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
