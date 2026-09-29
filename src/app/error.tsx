"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div
        role="alert"
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-2xl shadow-black/40"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-bg text-danger">
          <AlertTriangle size={26} />
        </div>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1.5 text-sm text-muted">
          We couldn&apos;t load this page. This is usually a temporary problem
          reaching the database. Please try again.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-muted">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="transition-smooth inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98]"
          >
            <RotateCcw size={14} />
            Try again
          </button>
          <Link
            href="/"
            className="transition-smooth rounded-xl border border-border px-4 py-2 text-sm font-medium hover:border-accent/40"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
