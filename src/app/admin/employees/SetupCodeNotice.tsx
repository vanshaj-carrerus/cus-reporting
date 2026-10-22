"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";

/** Shows a one-time setup code to the admin, who passes it on to the employee. */
export default function SetupCodeNotice({
  name,
  email,
  code,
  onDismiss,
}: {
  name: string;
  email: string;
  code: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // The code is on screen; the admin can still select and copy it by hand.
    }
  }

  return (
    <div
      role="status"
      className="animate-fade-in-up rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-sm"
    >
      <p className="flex items-start gap-2">
        <KeyRound size={15} className="mt-0.5 shrink-0 text-accent-text" />
        <span>
          Give <strong>{name}</strong> this setup code. In the app they choose
          &ldquo;First time? Set your password&rdquo; and enter <strong>{email}</strong> and
          the code. It works once and expires in 7 days — it won&apos;t be shown again.
        </span>
      </p>
      <div className="mt-2 flex items-center gap-2">
        <code className="rounded-md bg-surface-2 px-3 py-1 font-mono text-lg font-semibold tracking-widest">
          {code}
        </code>
        <button
          type="button"
          onClick={copy}
          className="transition-smooth flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="transition-smooth ml-auto rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2"
        >
          Done
        </button>
      </div>
    </div>
  );
}
