"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Moon } from "lucide-react";

const input =
  "rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function ShiftRow({
  id,
  name,
  startTime,
  endTime,
  lateGraceMinutes,
  employeeCount,
  delay,
}: {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateGraceMinutes: number;
  employeeCount: number;
  delay: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [start, setStart] = useState(startTime);
  const [end, setEnd] = useState(endTime);
  const [grace, setGrace] = useState(String(lateGraceMinutes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const overnight = endTime <= startTime;
  const people = `${employeeCount} ${employeeCount === 1 ? "employee" : "employees"}`;

  async function request(method: "PATCH" | "DELETE", body?: object): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/shifts/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (error ${res.status}).`);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const cleaned = nameValue.trim().replace(/\s+/g, " ");
    if (!cleaned) return setError("Name can't be empty.");
    if (!start || !end) return setError("Choose the start and end times.");
    const changes: Record<string, unknown> = {};
    if (cleaned !== name) changes.name = cleaned;
    if (start !== startTime) changes.startTime = start;
    if (end !== endTime) changes.endTime = end;
    if (Number(grace) !== lateGraceMinutes) changes.lateGraceMinutes = Number(grace);
    if (Object.keys(changes).length === 0) return setEditing(false);
    if (await request("PATCH", changes)) setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
    setNameValue(name);
    setStart(startTime);
    setEnd(endTime);
    setGrace(String(lateGraceMinutes));
    setError(null);
  }

  const iconBtn =
    "transition-smooth flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-50";

  return (
    <tr
      className="animate-fade-in-up transition-smooth hover:bg-surface-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              autoFocus
              value={nameValue}
              maxLength={60}
              aria-label={`Name for ${name}`}
              onChange={(e) => setNameValue(e.target.value)}
              className={`${input} w-40`}
            />
            <input type="time" aria-label="Start time (IST)" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
            <span className="text-muted">to</span>
            <input type="time" aria-label="End time (IST)" value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
            <label className="flex items-center gap-1 text-xs text-muted">
              Late after
              <input
                type="number"
                min={0}
                max={240}
                value={grace}
                onChange={(e) => setGrace(e.target.value)}
                className={`${input} w-16`}
              />
              min
            </label>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 font-medium">
              {name}
              {overnight && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted">
                  <Moon size={11} /> Night
                </span>
              )}
            </div>
            <div className="font-mono text-xs text-muted">
              {startTime} – {endTime} IST{overnight ? " (next day)" : ""} · late after{" "}
              {lateGraceMinutes} min · {people}
            </div>
          </div>
        )}
        {confirming && (
          <p className="mt-2 text-xs text-danger">
            Delete {name}? Its {people} will have no shift. Past attendance is kept.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <button aria-label="Save" disabled={busy} onClick={save} className={`${iconBtn} hover:text-success`}>
                <Check size={15} />
              </button>
              <button aria-label="Cancel" disabled={busy} onClick={cancelEdit} className={iconBtn}>
                <X size={15} />
              </button>
            </>
          ) : confirming ? (
            <>
              <button
                disabled={busy}
                onClick={async () => {
                  if (!(await request("DELETE"))) setConfirming(false);
                }}
                className="rounded-lg bg-danger px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                className={iconBtn}
                aria-label="Cancel"
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <>
              <button aria-label={`Edit ${name}`} onClick={() => setEditing(true)} className={`${iconBtn} hover:text-accent-text`}>
                <Pencil size={14} />
              </button>
              <button aria-label={`Delete ${name}`} onClick={() => setConfirming(true)} className={`${iconBtn} hover:text-danger`}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
