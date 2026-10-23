"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, Clock } from "lucide-react";

const NAME_MAX_LENGTH = 60;

export default function DepartmentRow({
  id,
  name,
  employeeCount,
  delay,
  shifts,
  breakPlans,
}: {
  shifts: { id: string; name: string }[];
  breakPlans: { id: string; name: string }[];
  id: string;
  name: string;
  employeeCount: number;
  delay: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  // "" = leave as is, "none" = clear, otherwise an id.
  const [shiftChoice, setShiftChoice] = useState("");
  const [planChoice, setPlanChoice] = useState("");
  const [assigned, setAssigned] = useState<string | null>(null);
  const router = useRouter();

  async function applySchedule() {
    const body: { shiftId?: string | null; breakPlanId?: string | null } = {};
    if (shiftChoice) body.shiftId = shiftChoice === "none" ? null : shiftChoice;
    if (planChoice) body.breakPlanId = planChoice === "none" ? null : planChoice;
    if (Object.keys(body).length === 0) {
      setError("Choose a shift and/or a break plan to apply.");
      return;
    }
    setBusy(true);
    setError(null);
    setAssigned(null);
    try {
      const res = await fetch(`/api/departments/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (error ${res.status}).`);
        return;
      }
      setAssigned(`Updated ${data.updated} ${data.updated === 1 ? "employee" : "employees"}.`);
      setShiftChoice("");
      setPlanChoice("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Returns true on success, or false after showing the error. */
  async function request(method: "PATCH" | "DELETE", body?: object): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/departments/${id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      // The body may not be JSON if something upstream failed, so don't assume it.
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
    const cleaned = value.trim().replace(/\s+/g, " ");
    if (!cleaned) {
      setError("Name can't be empty.");
      return;
    }
    if (cleaned === name) {
      setEditing(false);
      return;
    }
    if (await request("PATCH", { name: cleaned })) setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
    setValue(name);
    setError(null);
  }

  const iconBtn =
    "transition-smooth flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-50";
  const people = `${employeeCount} ${employeeCount === 1 ? "employee" : "employees"}`;

  return (
    <tr
      className="animate-fade-in-up transition-smooth hover:bg-surface-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <td className="px-4 py-3">
        {editing ? (
          <input
            autoFocus
            value={value}
            maxLength={NAME_MAX_LENGTH}
            aria-label={`Name for ${name}`}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancelEdit();
            }}
            className="w-full min-w-0 rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        ) : (
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-xs text-muted">{people}</div>
          </div>
        )}
        {confirming && (
          <p className="mt-2 text-xs text-danger">
            Delete {name}? Its {people} will become unassigned. No attendance records are removed.
          </p>
        )}
        {assigning && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-2">
            <select
              value={shiftChoice}
              aria-label={`Shift for everyone in ${name}`}
              onChange={(e) => setShiftChoice(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
            >
              <option value="">Shift: leave as is</option>
              <option value="none">Shift: clear</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={planChoice}
              aria-label={`Break plan for everyone in ${name}`}
              onChange={(e) => setPlanChoice(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs outline-none focus:border-accent"
            >
              <option value="">Breaks: leave as is</option>
              <option value="none">Breaks: clear</option>
              {breakPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button
              disabled={busy}
              onClick={applySchedule}
              className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground disabled:opacity-50"
            >
              {busy ? "Applying…" : `Apply to ${people}`}
            </button>
            {assigned && <span className="text-xs text-success">{assigned}</span>}
          </div>
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
              <button
                aria-label={`Assign shift and breaks to ${name}`}
                onClick={() => {
                  setAssigning((v) => !v);
                  setError(null);
                  setAssigned(null);
                }}
                className={`${iconBtn} hover:text-accent-text`}
              >
                <Clock size={14} />
              </button>
              <button
                aria-label={`Rename ${name}`}
                onClick={() => {
                  setValue(name);
                  setEditing(true);
                }}
                className={`${iconBtn} hover:text-accent-text`}
              >
                <Pencil size={14} />
              </button>
              <button
                aria-label={`Delete ${name}`}
                onClick={() => setConfirming(true)}
                className={`${iconBtn} hover:text-danger`}
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
