"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";

const NAME_MAX_LENGTH = 80;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function EmployeeRow({
  id,
  name,
  delay,
}: {
  id: string;
  name: string;
  delay: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function request(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${id}`, {
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

  return (
    <tr
      className="animate-fade-in-up transition-smooth hover:bg-surface-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent-text">
            {initials(name)}
          </div>
          {editing ? (
            <input
              autoFocus
              value={value}
              maxLength={NAME_MAX_LENGTH}
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
            <span className="font-medium">{name}</span>
          )}
        </div>
        {confirming && (
          <p className="mt-2 text-xs text-danger">
            Delete {name}? This also removes all their attendance records.
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
              <button
                aria-label={`Edit ${name}`}
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
