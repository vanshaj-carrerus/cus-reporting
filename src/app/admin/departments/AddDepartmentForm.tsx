"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertCircle } from "lucide-react";

const NAME_MAX_LENGTH = 60;

export default function AddDepartmentForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleaned = name.trim().replace(/\s+/g, " ");
    if (!cleaned) {
      setError("Please enter the department's name.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleaned }),
      });
      // The body may not be JSON if something upstream failed, so don't assume it.
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed to add department (error ${res.status}).`);
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
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="department-name" className="mb-1 block text-xs font-medium text-muted">
            Department name
          </label>
          <input
            id="department-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            maxLength={NAME_MAX_LENGTH}
            placeholder="e.g. Engineering"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "department-error" : undefined}
            className={`transition-smooth w-full rounded-lg border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:ring-2 ${
              error
                ? "border-danger/60 focus:border-danger focus:ring-danger/20"
                : "border-border focus:border-accent focus:ring-accent/20"
            }`}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="transition-smooth flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
        >
          <Plus size={14} />
          {submitting ? "Adding…" : "Add Department"}
        </button>
      </div>
      {error && (
        <p
          id="department-error"
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
