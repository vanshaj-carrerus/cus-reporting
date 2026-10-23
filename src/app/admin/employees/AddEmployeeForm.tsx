"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, AlertCircle } from "lucide-react";

const NAME_MAX_LENGTH = 80;

type Option = { id: string; name: string };

export default function AddEmployeeForm({
  departments,
  shifts,
  breakPlans,
}: {
  departments: Option[];
  shifts: Option[];
  breakPlans: Option[];
}) {
  const [shiftId, setShiftId] = useState("");
  const [breakPlanId, setBreakPlanId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [added, setAdded] = useState<{ name: string; email: string } | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdded(null);

    const cleaned = name.trim().replace(/\s+/g, " ");
    if (!cleaned) {
      setError("Please enter the employee's name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter the employee's email — it's what they sign in with.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleaned,
          email: email.trim(),
          departmentId: departmentId || null,
          shiftId: shiftId || null,
          breakPlanId: breakPlanId || null,
        }),
      });
      // The body may not be JSON if something upstream failed, so don't assume it.
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? `Failed to add employee (error ${res.status}).`);
        return;
      }

      setAdded({ name: data.employee.name, email: data.employee.email });
      setName("");
      setEmail("");
      setDepartmentId("");
      setShiftId("");
      setBreakPlanId("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl border border-border bg-surface p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="employee-name" className="mb-1 block text-xs font-medium text-muted">
            Employee name
          </label>
          <input
            id="employee-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            maxLength={NAME_MAX_LENGTH}
            placeholder="e.g. Asha Rao"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "employee-name-error" : undefined}
            className={`transition-smooth w-full rounded-lg border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:ring-2 ${
              error
                ? "border-danger/60 focus:border-danger focus:ring-danger/20"
                : "border-border focus:border-accent focus:ring-accent/20"
            }`}
          />
        </div>
        <div className="min-w-56 flex-1">
          <label htmlFor="employee-email" className="mb-1 block text-xs font-medium text-muted">
            Employee email
          </label>
          <input
            id="employee-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. asha@company.com"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "employee-name-error" : undefined}
            className={`transition-smooth w-full rounded-lg border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:ring-2 ${
              error
                ? "border-danger/60 focus:border-danger focus:ring-danger/20"
                : "border-border focus:border-accent focus:ring-accent/20"
            }`}
          />
        </div>
        <div className="min-w-44">
          <label htmlFor="employee-department" className="mb-1 block text-xs font-medium text-muted">
            Department
          </label>
          <select
            id="employee-department"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="transition-smooth w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">Unassigned</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-44">
          <label htmlFor="employee-shift" className="mb-1 block text-xs font-medium text-muted">
            Shift (IST)
          </label>
          <select
            id="employee-shift"
            value={shiftId}
            onChange={(e) => setShiftId(e.target.value)}
            className="transition-smooth w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">No shift</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-44">
          <label htmlFor="employee-breaks" className="mb-1 block text-xs font-medium text-muted">
            Break plan
          </label>
          <select
            id="employee-breaks"
            value={breakPlanId}
            onChange={(e) => setBreakPlanId(e.target.value)}
            className="transition-smooth w-full rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="">No breaks</option>
            {breakPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="transition-smooth flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98] disabled:opacity-50"
        >
          <UserPlus size={14} />
          {submitting ? "Adding…" : "Add Employee"}
        </button>
      </div>
      {added && (
        <p role="status" className="animate-fade-in-up mt-3 text-sm text-success">
          Added {added.name}. They can open the app, choose &ldquo;Set or reset your password&rdquo;,
          and a verification code will be emailed to {added.email}.
        </p>
      )}
      {error && (
        <p
          id="employee-name-error"
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
