// Employees who haven't used the app for a while.

export const INACTIVE_AFTER_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Anyone whose last activity is before this moment counts as inactive. */
export function inactiveCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - INACTIVE_AFTER_DAYS * DAY_MS);
}

/**
 * Mongo filter for the inactive. Employees from before activity was recorded have no
 * lastActiveAt, so the day they set their password (then the day they were added) stands in.
 */
export function inactiveFilter(now: Date = new Date()) {
  const cutoff = inactiveCutoff(now);
  return {
    $or: [
      { lastActiveAt: { $lt: cutoff } },
      { lastActiveAt: { $exists: false }, passwordSetAt: { $lt: cutoff } },
      { lastActiveAt: { $exists: false }, passwordSetAt: { $exists: false }, createdAt: { $lt: cutoff } },
    ],
  };
}

/** When the employee was last known to use the app (null = never signed in). */
export function lastActivity(e: { lastActiveAt?: Date | null; passwordSetAt?: Date | null }): Date | null {
  return e.lastActiveAt ?? e.passwordSetAt ?? null;
}

/** "3 days ago" style text for a past moment. */
export function agoText(from: Date, now: Date = new Date()): string {
  const hours = Math.floor((now.getTime() - from.getTime()) / (60 * 60 * 1000));
  if (hours < 1) return "less than an hour ago";
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}
