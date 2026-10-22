// One-time setup codes. The admin gives one to an employee so that only that
// person can choose the password for their account — knowing the email alone
// isn't enough, which is what stops a colleague claiming someone else's account.
// Also used to reset a forgotten password: the admin issues a fresh code.

import { randomInt } from "node:crypto";
import { hashPassword, verifyPassword } from "./password";

export const SETUP_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// No 0/O/1/I/L, so a code read aloud or off a screen isn't misread.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const GROUP = 4;

/** e.g. "K7QD-M2XP" — 8 characters, shown to the admin once. */
export function generateSetupCode(): string {
  const chars = Array.from(
    { length: GROUP * 2 },
    () => ALPHABET[randomInt(ALPHABET.length)]
  );
  return `${chars.slice(0, GROUP).join("")}-${chars.slice(GROUP).join("")}`;
}

/** Ignores case, spaces and dashes, so "k7qd m2xp" matches "K7QD-M2XP". */
export function normalizeSetupCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length === GROUP * 2 ? code : null;
}

/** The fields to store for a new code, plus the plain code to show once. */
export async function newSetupCode() {
  const code = generateSetupCode();
  return {
    code,
    fields: {
      setupCodeHash: await hashPassword(normalizeSetupCode(code)!),
      setupCodeExpiresAt: new Date(Date.now() + SETUP_CODE_TTL_MS),
    },
  };
}

export function verifySetupCode(
  code: string,
  storedHash: string | undefined
): Promise<boolean> {
  return verifyPassword(code, storedHash);
}
