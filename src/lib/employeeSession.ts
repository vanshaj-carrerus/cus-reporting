// Employee session primitives: a stateless signed token in an httpOnly cookie,
// the same approach as the admin session (lib/adminSession.ts).
//
// The signing key is *derived* from ADMIN_SESSION_SECRET with a purpose label,
// so an employee token can never pass as an admin token (or vice versa) even
// though they share the one secret. Without this, an employee could put their
// own token in the admin cookie.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const EMPLOYEE_SESSION_COOKIE = "employee_session";
export const EMPLOYEE_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

const MIN_SECRET_LENGTH = 32;

function signingKey(): Buffer | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) return null;
  return createHmac("sha256", secret).update("employee-session-v1").digest();
}

export function isEmployeeAuthConfigured(): boolean {
  return signingKey() !== null;
}

function sign(data: string, key: Buffer): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function createEmployeeToken(employeeId: string): string {
  const key = signingKey();
  if (!key) throw new Error("ADMIN_SESSION_SECRET isn't configured.");
  const payload = Buffer.from(
    JSON.stringify({
      sub: employeeId,
      iat: Date.now(),
      exp: Date.now() + EMPLOYEE_SESSION_MAX_AGE_SECONDS * 1000,
    })
  ).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

/**
 * The employee id and issue time inside a valid, unexpired token — otherwise
 * null. The issue time lets a password reset end sessions started before it.
 */
export function verifyEmployeeToken(
  token: string | undefined
): { id: string; issuedAt: number } | null {
  const key = signingKey();
  if (!token || !key) return null;

  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return null;
  if (!safeEqual(signature, sign(payload, key))) return null;

  try {
    const { sub, iat, exp } = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );
    return typeof sub === "string" &&
      typeof iat === "number" &&
      typeof exp === "number" &&
      exp > Date.now()
      ? { id: sub, issuedAt: iat }
      : null;
  } catch {
    return null;
  }
}

export const EMPLOYEE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/",
} as const;
