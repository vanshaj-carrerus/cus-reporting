export const EMAIL_MAX_LENGTH = 254;

// Deliberately loose: the only real proof an address is valid is the employee
// being able to use it. This just rejects obvious typos.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trimmed + lowercased, or null if it isn't a plausible email address. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) {
    return null;
  }
  return email;
}
