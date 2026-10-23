"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle } from "lucide-react";

const field =
  "transition-smooth w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function AddShiftForm() {
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("18:00");
  const [grace, setGrace] = useState("15");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = name.trim().replace(/\s+/g, " ");
    if (!cleaned) return setError("Please enter a shift name.");
    if (!startTime || !endTime) return setError("Please choose the start and end times.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleaned,
          startTime,
          endTime,
          lateGraceMinutes: Number(grace),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed to add shift (error ${res.status}).`);
        return;
      }
      setName("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const overnight = endTime !== "" && startTime !== "" && endTime <= startTime;

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="shift-name" className="mb-1 block text-xs font-medium text-muted">
            Shift name
          </label>
          <input
            id="shift-name"
            value={name}
            maxLength={60}
            placeholder="e.g. Day, Night"
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="shift-start" className="mb-1 block text-xs font-medium text-muted">
            Starts (IST)
          </label>
          <input
            id="shift-start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className={field}
          />
        </div>
        <div>
          <label htmlFor="shift-end" className="mb-1 block text-xs font-medium text-muted">
            Ends (IST)
          </label>
          <input
            id="shift-end"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className={field}
          />
        </div>
        <div className="w-28">
          <label htmlFor="shift-grace" className="mb-1 block text-xs font-medium text-muted">
            Late after (min)
          </label>
          <input
            id="shift-grace"
            type="number"
            min={0}
            max={240}
            value={grace}
            onChange={(e) => setGrace(e.target.value)}
            className={field}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="transition-smooth flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
        >
          <Plus size={14} />
          {submitting ? "Adding…" : "Add Shift"}
        </button>
      </div>
      {overnight && (
        <p className="mt-2 text-xs text-muted">
          Ends the next day — this is a night shift. Check-ins after midnight count towards the day
          it started.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="animate-fade-in-up mt-3 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger"
        >
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </form>
  );
}
