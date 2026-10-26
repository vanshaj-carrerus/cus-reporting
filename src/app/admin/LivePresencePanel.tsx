"use client";

import { useEffect, useState } from "react";
import { BellRing, Coffee, DoorOpen, MapPin, Send, WifiOff } from "lucide-react";
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
  // Which row has its alert box open, the text typed, and what happened last.
  const [alerting, setAlerting] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ id: string; ok: boolean; message: string } | null>(null);

  async function sendAlert(employeeId: string, attendanceId: string) {
    setSending(true);
    setNotice(null);
    try {
      const res = await fetch("/api/presence/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, message: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ id: attendanceId, ok: false, message: data.error ?? `Failed (error ${res.status}).` });
        return;
      }
      setNotice({ id: attendanceId, ok: true, message: "Alert sent." });
      setAlerting(null);
      setText("");
    } catch {
      setNotice({ id: attendanceId, ok: false, message: "Couldn't reach the server." });
    } finally {
      setSending(false);
    }
  }

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
              <li key={r.attendanceId} className="px-4 py-2.5 text-sm">
                <div className="flex flex-wrap items-center gap-3">
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
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                  {r.latitude !== null && r.longitude !== null ? (
                    <a
                      href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-accent-text hover:underline"
                    >
                      <MapPin size={12} />
                      {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
                    </a>
                  ) : (
                    <span className="text-muted">Location not reported yet</span>
                  )}
                  <button
                    onClick={() => {
                      setAlerting(alerting === r.attendanceId ? null : r.attendanceId);
                      setNotice(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 hover:bg-surface-2"
                  >
                    <Send size={12} />
                    Send alert
                  </button>
                  {notice?.id === r.attendanceId && (
                    <span className={notice.ok ? "text-success" : "text-danger"}>{notice.message}</span>
                  )}
                </div>
                {alerting === r.attendanceId && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-2">
                    <input
                      autoFocus
                      value={text}
                      maxLength={200}
                      placeholder="Message (optional) — default: please return to the office"
                      aria-label={`Alert message for ${r.name}`}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !sending && sendAlert(r.employeeId, r.attendanceId)}
                      className="min-w-56 flex-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
                    />
                    <button
                      disabled={sending}
                      onClick={() => sendAlert(r.employeeId, r.attendanceId)}
                      className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50"
                    >
                      {sending ? "Sending…" : `Send to ${r.name.split(" ")[0]}`}
                    </button>
                    {!r.canAlert && (
                      <span className="text-xs text-warning">
                        Their phone hasn&apos;t registered for alerts yet.
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
