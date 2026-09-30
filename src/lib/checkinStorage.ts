// Remembers, per browser, who checked in today. MongoDB stays the source of
// truth (the API rejects duplicates); this just lets the UI skip the roster
// picker and the location prompt for someone who's already done it.

import { istDateKey } from "./time";

const KEY = "attendance:last-check-in";

export interface SavedCheckIn {
  employeeId: string;
  date: string; // IST calendar day, YYYY-MM-DD
  checkInTime?: string;
  status?: string;
}

/** Returns today's saved check-in, or null (a new day makes it expire). */
export function readTodayCheckIn(): SavedCheckIn | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedCheckIn;
    if (saved.date !== istDateKey()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

export function saveTodayCheckIn(entry: Omit<SavedCheckIn, "date">): void {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...entry, date: istDateKey() })
    );
  } catch {
    // Storage blocked (private mode etc.) — the server check still applies.
  }
}
