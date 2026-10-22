// Email verification codes. The employee asks for one from the app; it's emailed
// to the address the admin registered, so only whoever controls that inbox can
// set or reset the password. Stored hashed, short-lived, single-use, and
// invalidated after a few wrong guesses.

import { randomInt } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";

export const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const VERIFICATION_CODE_MAX_ATTEMPTS = 5;
/** Minimum gap between two emails to the same address. */
export const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

// Keep in step with the regex in normalizeVerificationCode.
const CODE_LENGTH = 6;

/** e.g. "048213" — always 6 digits, leading zeros kept. */
export function generateVerificationCode(): string {
  return randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, "0");
}

/** Strips spaces and dashes ("048 213" → "048213"); null unless it's 6 digits. */
export function normalizeVerificationCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}

/** The fields to store for a new code, plus the plain code to email. */
export async function newVerificationCode() {
  const code = generateVerificationCode();
  return {
    code,
    fields: {
      verifyCodeHash: await hashPassword(code),
      verifyCodeExpiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      verifyCodeSentAt: new Date(),
      verifyCodeAttempts: 0,
    },
  };
}

/** Pass `storedHash` as undefined when there's no code, to still spend the same time. */
export function verifyVerificationCode(
  code: string,
  storedHash: string | undefined
): Promise<boolean> {
  return verifyPassword(code, storedHash);
}
