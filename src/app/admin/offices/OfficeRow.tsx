"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X } from "lucide-react";

const NAME_MAX_LENGTH = 60;

const inputClass =
  "w-full min-w-0 rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function OfficeRow({
  id,
  name,
  latitude,
  longitude,
  radiusMeters,
  delay,
}: {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  delay: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({
    name,
    latitude: String(latitude),
    longitude: String(longitude),
    radiusMeters: String(radiusMeters),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError(null);
  };

  /** Returns true on success, or false after showing the error. */
  async function request(method: "PATCH" | "DELETE", body?: object): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/offices/${id}`, {
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
    if (await request("PATCH", form)) setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
    setForm({
      name,
      latitude: String(latitude),
      longitude: String(longitude),
      radiusMeters: String(radiusMeters),
    });
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
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              autoFocus
              value={form.name}
              maxLength={NAME_MAX_LENGTH}
              aria-label={`Name for ${name}`}
              onChange={set("name")}
              onKeyDown={(e) => e.key === "Escape" && cancelEdit()}
              className={`${inputClass} sm:col-span-3`}
            />
            <input
              value={form.latitude}
              inputMode="decimal"
              aria-label="Latitude"
              onChange={set("latitude")}
              className={inputClass}
            />
            <input
              value={form.longitude}
              inputMode="decimal"
              aria-label="Longitude"
              onChange={set("longitude")}
              className={inputClass}
            />
            <input
              value={form.radiusMeters}
              inputMode="numeric"
              aria-label="Radius in meters"
              onChange={set("radiusMeters")}
              className={inputClass}
            />
          </div>
        ) : (
          <div>
            <div className="font-medium">{name}</div>
            <div className="font-mono text-xs text-muted">
              {latitude}, {longitude} · {radiusMeters} m radius
            </div>
          </div>
        )}
        {confirming && (
          <p className="mt-2 text-xs text-danger">
            Delete {name}? Employees will no longer be able to check in from there.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right align-top">
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
                onClick={() => setEditing(true)}
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
