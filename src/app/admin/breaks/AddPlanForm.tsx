"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle } from "lucide-react";
import BreakRowsEditor, { checkRows, type BreakRow } from "./BreakRowsEditor";

export default function AddPlanForm() {
  const [name, setName] = useState("");
  const [rows, setRows] = useState<BreakRow[]>([
    { name: "Lunch", startTime: "13:30", endTime: "14:15" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = name.trim().replace(/\s+/g, " ");
    if (!cleaned) return setError("Please enter a plan name.");
    const problem = checkRows(rows);
    if (problem) return setError(problem);

    setSubmitting(true);
    try {
      const res = await fetch("/api/break-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleaned, breaks: rows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed to add plan (error ${res.status}).`);
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

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-border bg-surface p-4">
      <label htmlFor="plan-name" className="mb-1 block text-xs font-medium text-muted">
        Break plan name
      </label>
      <input
        id="plan-name"
        value={name}
        maxLength={60}
        placeholder="e.g. Day shift breaks"
        onChange={(e) => {
          setName(e.target.value);
          setError(null);
        }}
        className="transition-smooth mb-3 w-full max-w-sm rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <p className="mb-2 text-xs font-medium text-muted">Fixed break times (IST)</p>
      <BreakRowsEditor rows={rows} onChange={setRows} />
      <div className="mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="transition-smooth flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
        >
          <Plus size={14} />
          {submitting ? "Adding…" : "Add Break Plan"}
        </button>
      </div>
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
