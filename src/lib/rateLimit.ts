// Simple in-memory brute-force limiter. Resets on server restart and isn't
// shared between instances — fine for a single deployment (same trade-off as
// the admin login limiter).

import type { NextRequest } from "next/server";

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export class FailureLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly maxFailures: number,
    private readonly lockoutMs: number
  ) {}

  /** Seconds until `key` may try again, or 0 if it isn't locked out. */
  retryAfterSeconds(key: string): number {
    const record = this.attempts.get(key);
    if (!record) return 0;
    const now = Date.now();
    if (record.resetAt <= now) {
      this.attempts.delete(key);
      return 0;
    }
    return record.count >= this.maxFailures
      ? Math.ceil((record.resetAt - now) / 1000)
      : 0;
  }

  recordFailure(key: string): void {
    const now = Date.now();
    const record = this.attempts.get(key);
    if (!record || record.resetAt <= now) {
      this.attempts.set(key, { count: 1, resetAt: now + this.lockoutMs });
    } else {
      record.count += 1;
    }
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }
}

// Limiters live on globalThis so dev hot reloads don't reset them.
const globalForLimiters = globalThis as unknown as {
  failureLimiters?: Map<string, FailureLimiter>;
};

export function getLimiter(
  name: string,
  maxFailures: number,
  lockoutMs: number
): FailureLimiter {
  const all = (globalForLimiters.failureLimiters ??= new Map());
  let limiter = all.get(name);
  if (!limiter) {
    limiter = new FailureLimiter(maxFailures, lockoutMs);
    all.set(name, limiter);
  }
  return limiter;
}
