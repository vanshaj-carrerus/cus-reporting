"use client";

import { useEffect, useState } from "react";
import { BellRing, Coffee, DoorOpen, WifiOff } from "lucide-react";
import type { LivePresenceRow } from "@/lib/livePresence";

const POLL_MS = 30_000;

const STATE_INFO: Record<
  string,
  { label: string; className: string; icon: typeof Coffee }
> = {
  BREAK_OVERRUN: {
    label: "Break over — still outside",
    className: "border-danger/30 bg-danger-bg text-danger",
    icon: BellRing,
  },
  OUTSIDE: {
    label: "Outside, not on break",
    className: "border-danger/30 bg-danger-bg text-danger",
    icon: DoorOpen,
  },
  NO_SIGNAL: {
    label: "No signal",
    className: "border-warning/30 bg-warning-bg text-warning",
    icon: WifiOff,
  },
  ON_BREAK: {
    label: "On break",
    className: "border-accent/30 bg-accent/10 text-accent-text",
    icon: Coffee,
  },
};

// Worst first, so the people who need attention are at the top.
const ORDER = ["BREAK_OVERRUN", "OUTSIDE", "NO_SIGNAL", "ON_BREAK"];

function minutesSince(iso: string | null, now: number): string {
  if (!iso) return "—";
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/**
 * Who is checked in but not in the office right now, refreshed every 30 s.
 * The server decides each state; this only shows it.
 */
export default function LivePresencePanel({
  initialRows,
  initialAt,
}: {
  initialRows: LivePresenceRow[];
  initialAt: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [at, setAt] = useState(initialAt);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch("/api/presence/live", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (cancelled) return;
        setRows(data.rows);
        setAt(data.at);
        setStale(false);
      } catch {
        if (!cancelled) setStale(true);
      }
    }
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const now = new Date(at).getTime();
  const attention = rows
    .filter((r) => ORDER.includes(r.state))
    .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state));
  const inside = rows.filter((r) => r.state === "INSIDE").length;
  const urgent = attention.filter((r) => r.state === "BREAK_OVERRUN" || r.state === "OUTSIDE").length;

  return (
    <section
      aria-label="Outside right now"
      className="animate-fade-in-up mb-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Outside right now</h2>
          {urgent > 0 && (
            <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-medium text-white">
              {urgent} need attention
            </span>
          )}
        </div>
        <p className="text-xs text-muted">
          {inside} inside · {attention.length} away · updates every 30 s
          {stale && <span className="ml-2 text-warning">Couldn&apos;t refresh</span>}
        </p>
      </div>
      {attention.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">
          {rows.length === 0
            ? "Nobody is checked in on shift right now."
            : "Everyone on shift is in the office."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {attention.map((r) => {
            const info = STATE_INFO[r.state];
            const since = r.state === "BREAK_OVERRUN" ? r.overrunSince : r.outsideSince;
            return (
              <li key={r.attendanceId} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-40 flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted">
                    {[r.department, r.shift].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${info.className}`}
                >
                  <info.icon size={12} />
                  {info.label}
                </span>
                <div className="w-28 text-right text-xs text-muted">
                  {r.state === "NO_SIGNAL"
                    ? `last seen ${minutesSince(r.lastSeenAt, now)} ago`
                    : `${minutesSince(since, now)} ${r.state === "BREAK_OVERRUN" ? "over" : "away"}`}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
