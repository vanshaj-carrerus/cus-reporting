import { NextRequest, NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/email";
import { isMailConfigured, MAIL_NOT_CONFIGURED, sendVerificationEmail } from "@/lib/mailer";
import { connectToDatabase } from "@/lib/mongodb";
import { clientIp, getLimiter } from "@/lib/rateLimit";
import {
  newVerificationCode,
  VERIFICATION_RESEND_COOLDOWN_MS,
} from "@/lib/verificationCode";
import { Employee } from "@/models/Employee";

// Every request counts (not just failures), because each one can send an email.
const perEmailLimiter = getLimiter("request-code-email", 5, 60 * 60 * 1000);
const perClientLimiter = getLimiter("request-code-client", 15, 60 * 60 * 1000);

const SENT = {
  message: "If that email is registered, a verification code is on its way.",
};

// POST /api/auth/request-code — the employee asks for a verification code to be
// emailed to them. It serves both first-time setup and a forgotten password. The
// answer is the same whether or not the email is registered, so this can't be
// used to find out who works here.
export async function POST(request: NextRequest) {
  let body: { email?: unknown };
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
      { error: "Enter a valid email address." },
      { status: 400 }
    );
  }

  const client = clientIp(request);
  const emailKey = `${client}|${email}`;
  const retryAfter = Math.max(
    perEmailLimiter.retryAfterSeconds(emailKey),
    perClientLimiter.retryAfterSeconds(client)
  );
  if (retryAfter > 0) {
    return NextResponse.json(
      {
        error: `Too many code requests. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  perEmailLimiter.recordFailure(emailKey);
  perClientLimiter.recordFailure(client);

  if (!isMailConfigured()) {
    console.error(MAIL_NOT_CONFIGURED);
    return NextResponse.json(
      { error: "Email sending isn't set up on the server yet. Please tell your admin." },
      { status: 503 }
    );
  }

  try {
    await connectToDatabase();
    const employee = await Employee.findOne({ email }).select("+verifyCodeSentAt");
    if (!employee) return NextResponse.json(SENT);

    // A second request within the cooldown is a double-tap or a resend loop.
    const sentAt = employee.verifyCodeSentAt?.getTime() ?? 0;
    const wait = sentAt + VERIFICATION_RESEND_COOLDOWN_MS - Date.now();
    if (wait > 0) {
      const seconds = Math.ceil(wait / 1000);
      return NextResponse.json(
        { error: `A code was just sent. Wait ${seconds} second(s) before asking for another.` },
        { status: 429, headers: { "Retry-After": String(seconds) } }
      );
    }

    // Replacing the stored code means only the newest one works.
    const { code, fields } = await newVerificationCode();
    await Employee.updateOne({ _id: employee._id }, fields);

    try {
      await sendVerificationEmail(email, employee.name, code);
    } catch (error) {
      console.error("Sending the verification email failed:", error);
      // Let them retry straight away instead of waiting out the cooldown.
      await Employee.updateOne(
        { _id: employee._id },
        {
          $unset: {
            verifyCodeHash: 1,
            verifyCodeExpiresAt: 1,
            verifyCodeSentAt: 1,
            verifyCodeAttempts: 1,
          },
        }
      );
      return NextResponse.json(
        { error: "Couldn't send the email. Please try again in a moment." },
        { status: 502 }
      );
    }

    return NextResponse.json(SENT);
  } catch (error) {
    console.error("POST /api/auth/request-code failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
