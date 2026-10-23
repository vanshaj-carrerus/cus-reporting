"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

type Settings = {
  earlyCheckInMinutes: number;
  noSignalMinutes: number;
  alarmIntervalMinutes: number;
  ringsBeforeSilence: number;
};

const FIELDS: { key: keyof Settings; label: string; hint: string; min: number; max: number }[] = [
  {
    key: "earlyCheckInMinutes",
    label: "Early check-in window (min)",
    hint: "How long before a shift starts employees can check in.",
    min: 0,
    max: 720,
  },
  {
    key: "alarmIntervalMinutes",
    label: "Alarm repeats every (min)",
    hint: "When a break is over and the employee is still outside.",
    min: 1,
    max: 30,
  },
  {
    key: "ringsBeforeSilence",
    label: "Rings before it can be silenced",
    hint: "The employee can only silence the alarm after this many rings.",
    min: 1,
    max: 20,
  },
  {
    key: "noSignalMinutes",
    label: "No signal after (min)",
    hint: "Phone silent this long during a shift = shown as No signal.",
    min: 2,
    max: 120,
  },
];

export default function SettingsForm({ settings }: { settings: Settings }) {
  const [values, setValues] = useState<Record<keyof Settings, string>>({
    earlyCheckInMinutes: String(settings.earlyCheckInMinutes),
    noSignalMinutes: String(settings.noSignalMinutes),
    alarmIntervalMinutes: String(settings.alarmIntervalMinutes),
    ringsBeforeSilence: String(settings.ringsBeforeSilence),
  });
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/shift-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)]))
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ ok: false, text: data.error ?? `Failed to save (error ${res.status}).` });
        return;
      }
      setMessage({ ok: true, text: "Saved." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Couldn't reach the server. Check your connection." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="rounded-xl border border-border bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={f.key} className="mb-1 block text-xs font-medium text-muted">
              {f.label}
            </label>
            <input
              id={f.key}
              type="number"
              min={f.min}
              max={f.max}
              value={values[f.key]}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              className="transition-smooth w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
            <p className="mt-1 text-xs text-muted">{f.hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="transition-smooth flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
        >
          <Save size={14} />
          {busy ? "Saving…" : "Save rules"}
        </button>
        {message && (
          <span role="status" className={`text-sm ${message.ok ? "text-success" : "text-danger"}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
