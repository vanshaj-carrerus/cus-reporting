"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, KeyRound, ShieldCheck, User } from "lucide-react";

// Only allow redirecting back into the admin area (never to another site).
function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/admin") && !next.startsWith("//")) {
    return next;
  }
  return "/admin";
}

export default function LoginForm({
  next,
  configError,
}: {
  next?: string;
  configError: string | null;
}) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(configError);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!id.trim() || !password) {
      setError("Enter both your admin ID and password.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? `Sign-in failed (error ${res.status}).`);
        setPassword("");
        return;
      }

      router.replace(safeNext(next));
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "transition-smooth w-full rounded-xl border border-border bg-surface-2 py-3 pl-10 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <main className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
      <form
        onSubmit={handleSubmit}
        className="animate-scale-in w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/40"
      >
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent-text">
          <ShieldCheck size={26} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin sign-in</h1>
        <p className="mt-1.5 text-sm text-muted">
          Enter your admin ID and password to open the dashboard.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="admin-id" className="mb-1.5 block text-sm font-medium">
              Admin ID
            </label>
            <div className="relative">
              <User
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="admin-id"
                type="text"
                autoComplete="username"
                autoFocus
                value={id}
                onChange={(e) => setId(e.target.value)}
                className={`${inputClass} pr-4`}
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="mb-1.5 block text-sm font-medium">
              Password
            </label>
            <div className="relative">
              <KeyRound
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="animate-fade-in-up mt-4 flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || Boolean(configError)}
          className="transition-smooth group mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
          {!submitting && (
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          )}
        </button>
      </form>
    </main>
  );
}
