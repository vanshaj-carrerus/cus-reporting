// Admin session primitives. Pure Node crypto (no Next imports) so it can be
// used from both proxy.ts and route handlers.
//
// The session is a stateless signed token: base64url(payload) "." HMAC-SHA256.
// Nothing is stored server-side; the token simply expires.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

export const AUTH_NOT_CONFIGURED_MESSAGE =
  "Admin login isn't configured. Set ADMIN_ID, ADMIN_PASSWORD and ADMIN_SESSION_SECRET (at least 32 characters) in .env and restart the server.";

const MIN_SECRET_LENGTH = 32;

function sessionSecret(): string | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/** False means admin is locked out entirely — we fail closed, never open. */
export function isAuthConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_ID && process.env.ADMIN_PASSWORD && sessionSecret()
  );
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  // Hash first so both buffers are the same length and timing doesn't leak length.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkCredentials(id: string, password: string): boolean {
  const expectedId = process.env.ADMIN_ID;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedId || !expectedPassword) return false;
  // Evaluate both (no short-circuit) so a wrong ID isn't distinguishable by timing.
  const idOk = safeEqual(id, expectedId);
  const passwordOk = safeEqual(password, expectedPassword);
  return idOk && passwordOk;
}

export function createSessionToken(): string {
  const secret = sessionSecret();
  if (!secret) throw new Error(AUTH_NOT_CONFIGURED_MESSAGE);
  const payload = Buffer.from(
    JSON.stringify({
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
      n: randomBytes(8).toString("hex"),
    })
  ).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  const secret = sessionSecret();
  if (!token || !secret) return false;

  const [payload, signature, ...rest] = token.split(".");
  if (!payload || !signature || rest.length > 0) return false;

  if (!safeEqual(signature, sign(payload, secret))) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}
