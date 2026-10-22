"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Check, X, KeyRound } from "lucide-react";
import SetupCodeNotice from "./SetupCodeNotice";

const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

type ApiResult = { setupCode?: string; employee?: { email?: string | null } };

/** Where an employee is in getting started: no email → invited → active. */
function accountState(email: string | null, passwordSet: boolean) {
  if (!email) return { label: "No email", className: "text-warning" };
  if (!passwordSet) return { label: "Invited", className: "text-muted" };
  return { label: "Active", className: "text-success" };
}

export default function EmployeeRow({
  id,
  name,
  email,
  passwordSet,
  delay,
}: {
  id: string;
  name: string;
  email: string | null;
  passwordSet: boolean;
  delay: number;
}) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [issued, setIssued] = useState<{ email: string; code: string } | null>(null);
  const [value, setValue] = useState(name);
  const [emailValue, setEmailValue] = useState(email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const state = accountState(email, passwordSet);

  /** Returns the response body on success, or null after showing the error. */
  async function request(
    method: "PATCH" | "POST" | "DELETE",
    options: { body?: object; path?: string } = {}
  ): Promise<ApiResult | null> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${id}${options.path ?? ""}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      // The body may not be JSON if something upstream failed, so don't assume it.
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Request failed (error ${res.status}).`);
        return null;
      }
      router.refresh();
      return data;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const cleaned = value.trim().replace(/\s+/g, " ");
    const cleanedEmail = emailValue.trim();
    if (!cleaned) {
      setError("Name can't be empty.");
      return;
    }
    if (!cleanedEmail) {
      setError("Email can't be empty — it's what they sign in with.");
      return;
    }
    const changes: { name?: string; email?: string } = {};
    if (cleaned !== name) changes.name = cleaned;
    if (cleanedEmail.toLowerCase() !== (email ?? "")) changes.email = cleanedEmail;
    if (!changes.name && !changes.email) {
      setEditing(false);
      return;
    }
    const data = await request("PATCH", { body: changes });
    if (!data) return;
    setEditing(false);
    // Only sent when this employee had no email before: they now need a code.
    if (data.setupCode) {
      setIssued({ email: data.employee?.email ?? cleanedEmail, code: data.setupCode });
    }
  }

  async function resetPassword() {
    const data = await request("POST", { path: "/reset-password" });
    setResetting(false);
    if (data?.setupCode) {
      setIssued({ email: data.employee?.email ?? email ?? "", code: data.setupCode });
    }
  }

  function cancelEdit() {
    setEditing(false);
    setValue(name);
    setEmailValue(email ?? "");
    setError(null);
  }

  const iconBtn =
    "transition-smooth flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-50";
  const inputClass =
    "w-full min-w-0 rounded-lg border border-border bg-surface-2 px-2 py-1 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";

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
            <div className="flex w-full min-w-0 flex-col gap-1.5">
              <input
                autoFocus
                value={value}
                maxLength={NAME_MAX_LENGTH}
                aria-label={`Name for ${name}`}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") cancelEdit();
                }}
                className={inputClass}
              />
              <input
                type="email"
                value={emailValue}
                maxLength={EMAIL_MAX_LENGTH}
                placeholder="Email"
                autoComplete="off"
                aria-label={`Email for ${name}`}
                onChange={(e) => {
                  setEmailValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                  if (e.key === "Escape") cancelEdit();
                }}
                className={inputClass}
              />
            </div>
          ) : (
            <div className="min-w-0">
              <div className="font-medium">{name}</div>
              <div className="truncate text-xs text-muted">
                {email ?? "Add an email so they can sign in"}
              </div>
              <div className={`text-xs font-medium ${state.className}`}>{state.label}</div>
            </div>
          )}
        </div>
        {confirming && (
          <p className="mt-2 text-xs text-danger">
            Delete {name}? This also removes their account and all their attendance records.
          </p>
        )}
        {resetting && (
          <p className="mt-2 text-xs text-danger">
            Reset {name}&apos;s password? They&apos;ll be signed out everywhere and need a new
            setup code to choose a password again.
          </p>
        )}
        {issued && (
          <div className="mt-2">
            <SetupCodeNotice
              name={name}
              email={issued.email}
              code={issued.code}
              onDismiss={() => setIssued(null)}
            />
          </div>
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
          ) : resetting ? (
            <>
              <button
                disabled={busy}
                onClick={resetPassword}
                className="rounded-lg bg-danger px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
              >
                {busy ? "Resetting…" : "Reset"}
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setResetting(false);
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
                  setEmailValue(email ?? "");
                  setIssued(null);
                  setEditing(true);
                }}
                className={`${iconBtn} hover:text-accent-text`}
              >
                <Pencil size={14} />
              </button>
              {email && (
                <button
                  aria-label={
                    passwordSet
                      ? `Reset password for ${name}`
                      : `New setup code for ${name}`
                  }
                  title={passwordSet ? "Reset password" : "New setup code"}
                  onClick={() => {
                    setIssued(null);
                    // Nothing to lose before first setup, so no confirmation.
                    if (passwordSet) setResetting(true);
                    else resetPassword();
                  }}
                  className={`${iconBtn} hover:text-accent-text`}
                >
                  <KeyRound size={14} />
                </button>
              )}
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
