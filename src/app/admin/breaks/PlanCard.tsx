"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";
import BreakRowsEditor, { checkRows, type BreakRow } from "./BreakRowsEditor";

export default function PlanCard({
  id,
  name,
  breaks,
  employeeCount,
  delay,
}: {
  id: string;
  name: string;
  breaks: BreakRow[];
  employeeCount: number;
  delay: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [rows, setRows] = useState<BreakRow[]>(breaks);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const people = `${employeeCount} ${employeeCount === 1 ? "employee" : "employees"}`;

  async function request(method: "PATCH" | "DELETE", body?: object): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/break-plans/${id}`, {
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
    const problem = checkRows(rows);
    if (problem) return setError(problem);
    if (await request("PATCH", { name: cleaned, breaks: rows })) setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
    setNameValue(name);
    setRows(breaks);
    setError(null);
  }

  const iconBtn =
    "transition-smooth flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-50";

  return (
    <div
      className="animate-fade-in-up rounded-xl border border-border bg-surface p-4 shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={nameValue}
              maxLength={60}
              aria-label={`Name for ${name}`}
              onChange={(e) => setNameValue(e.target.value)}
              className="mb-3 w-full max-w-sm rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          ) : (
            <div className="font-medium">
              {name} <span className="text-xs font-normal text-muted">· {people}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
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
                aria-label="Cancel"
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
                className={iconBtn}
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
      </div>

      {editing ? (
        <BreakRowsEditor rows={rows} onChange={setRows} />
      ) : breaks.length === 0 ? (
        <p className="mt-1 text-xs text-muted">No breaks in this plan.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {breaks.map((b) => (
            <li
              key={`${b.name}-${b.startTime}`}
              className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs"
            >
              <span className="font-medium">{b.name}</span>{" "}
              <span className="font-mono text-muted">
                {b.startTime}–{b.endTime}
              </span>
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <p className="mt-2 text-xs text-danger">
          Delete {name}? Its {people} will have no scheduled breaks.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
