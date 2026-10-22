// Password hashing with Node's built-in scrypt, so there's no extra dependency.
// Stored as "scrypt$<salt hex>$<hash hex>".

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) =>
      error ? reject(error) : resolve(key)
    );
  });
}

/** Returns an error message if the password isn't acceptable, else null. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

/** Pass `stored` as undefined when there's no account, to still spend the same time. */
export async function verifyPassword(
  password: string,
  stored: string | undefined
): Promise<boolean> {
  const [scheme, saltHex, keyHex] = (stored ?? "").split("$");
  const valid = scheme === "scrypt" && Boolean(saltHex) && Boolean(keyHex);

  const salt = valid ? Buffer.from(saltHex, "hex") : Buffer.alloc(16);
  const expected = valid ? Buffer.from(keyHex, "hex") : Buffer.alloc(KEY_LENGTH);
  const actual = await derive(password, salt);

  return (
    valid &&
    expected.length === actual.length &&
    timingSafeEqual(expected, actual)
  );
}
