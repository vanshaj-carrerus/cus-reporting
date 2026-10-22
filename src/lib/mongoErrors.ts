export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

/** True if a duplicate-key error was raised by the unique index on `field`. */
export function isDuplicateOn(error: unknown, field: string): boolean {
  const keyPattern = (error as { keyPattern?: Record<string, unknown> } | null)
    ?.keyPattern;
  return isDuplicateKeyError(error) && Boolean(keyPattern && field in keyPattern);
}
