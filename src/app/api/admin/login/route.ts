import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_NOT_CONFIGURED_MESSAGE,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  checkCredentials,
  createSessionToken,
  isAuthConfigured,
} from "@/lib/adminSession";

// Simple in-memory brute-force limiter, per client IP. Resets on server
// restart and isn't shared between instances — fine for a single deployment.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const globalForLimiter = globalThis as unknown as {
  adminLoginAttempts?: Map<string, { count: number; resetAt: number }>;
};
const attempts = (globalForLimiter.adminLoginAttempts ??= new Map());

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    console.error(AUTH_NOT_CONFIGURED_MESSAGE);
    return NextResponse.json(
      { error: AUTH_NOT_CONFIGURED_MESSAGE },
      { status: 503 }
    );
  }

  let body: { id?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  if (typeof body.id !== "string" || typeof body.password !== "string") {
    return NextResponse.json(
      { error: "Enter both your admin ID and password." },
      { status: 400 }
    );
  }

  const key = clientKey(request);
  const now = Date.now();
  const record = attempts.get(key);
  if (record && record.resetAt <= now) attempts.delete(key);

  const current = attempts.get(key);
  if (current && current.count >= MAX_FAILED_ATTEMPTS) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    return NextResponse.json(
      {
        error: `Too many failed attempts. Try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  if (!checkCredentials(body.id.trim(), body.password)) {
    attempts.set(key, {
      count: (current?.count ?? 0) + 1,
      resetAt: current?.resetAt ?? now + LOCKOUT_MS,
    });
    return NextResponse.json(
      { error: "Incorrect admin ID or password." },
      { status: 401 }
    );
  }

  attempts.delete(key);

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict blocks the cookie on cross-site requests, which closes off CSRF.
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
