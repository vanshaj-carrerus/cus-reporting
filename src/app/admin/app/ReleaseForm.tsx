"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check } from "lucide-react";

const inputClass =
  "transition-smooth w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

export default function ReleaseForm({
  latestVersion,
  updateUrl,
  message,
}: {
  latestVersion: string;
  updateUrl: string;
  message: string;
}) {
  const [form, setForm] = useState({ latestVersion, updateUrl, message });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError(null);
    setSaved(false);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/app-release", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed to save (error ${res.status}).`);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mb-6 rounded-xl border border-border bg-surface p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="release-version" className="mb-1 block text-xs font-medium text-muted">
            Newest app version
          </label>
          <input
            id="release-version"
            value={form.latestVersion}
            placeholder="e.g. 1.2.0 (empty = no update notice)"
            onChange={set("latestVersion")}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="release-url" className="mb-1 block text-xs font-medium text-muted">
            Download link
          </label>
          <input
            id="release-url"
            value={form.updateUrl}
            placeholder="https://… (Play Store or APK link)"
            onChange={set("updateUrl")}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="release-message" className="mb-1 block text-xs font-medium text-muted">
            Message to employees (optional)
          </label>
          <input
            id="release-message"
            value={form.message}
            maxLength={200}
            placeholder="e.g. New alerts and location fixes — please update today."
            onChange={set("message")}
            className={inputClass}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="transition-smooth rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved && (
          <span className="flex items-center gap-1 text-sm text-success">
            <Check size={14} /> Saved
          </span>
        )}
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
