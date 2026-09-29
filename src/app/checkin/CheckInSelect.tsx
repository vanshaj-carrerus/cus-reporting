"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readTodayCheckIn } from "@/lib/checkinStorage";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Users,
  Fingerprint,
  Lock,
  ShieldCheck,
  IdCard,
} from "lucide-react";

interface EmployeeOption {
  id: string;
  name: string;
}

// Only employees the admin has added show up here — check-in is restricted
// to this list, no free-text employee IDs.
export default function CheckInSelect({
  employees,
}: {
  employees: EmployeeOption[];
}) {
  const [employeeId, setEmployeeId] = useState("");
  const router = useRouter();
  // Hold the roster back until we know this browser hasn't already checked in.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = readTodayCheckIn();
    if (saved) {
      router.replace(`/checkin/${saved.employeeId}`);
      return;
    }
    const timer = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(timer);
  }, [router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (employeeId) {
      router.push(`/checkin/${employeeId}`);
    }
  }

  if (!ready) {
    return <main className="min-h-screen" aria-busy="true" />;
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-4 py-6">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />

      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/"
          className="transition-smooth inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center py-10">
        <form
          onSubmit={handleSubmit}
          className="animate-scale-in w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-2xl shadow-black/40"
        >
          <div className="mb-6 flex items-start justify-between">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent-text">
              <Fingerprint size={26} />
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-accent-text">
              <ShieldCheck size={12} />
              Geo-secured
            </span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Employee Check-In</h1>
          <p className="mt-1.5 text-sm text-muted">
            Select your name from the verified organization roster to continue.
          </p>

          {employees.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-center">
              <Users size={20} className="text-muted" />
              <p className="text-sm text-muted">
                No employees have been added yet. Contact your admin.
              </p>
            </div>
          ) : (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="employee" className="text-sm font-medium">
                  Employee identity
                </label>
                <span className="inline-flex items-center gap-1 rounded bg-surface-2 px-2 py-0.5 text-[11px] text-muted">
                  <Lock size={10} />
                  Restricted to admin-added staff
                </span>
              </div>
              <div className="relative">
                <IdCard
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <select
                  id="employee"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  className="transition-smooth w-full appearance-none rounded-xl border border-border bg-surface-2 py-3 pl-10 pr-10 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value="" disabled>
                    Choose your registered name
                  </option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={employees.length === 0 || !employeeId}
            className="transition-smooth group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted"
          >
            Continue to verification
            <ArrowRight
              size={15}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </button>

          <div className="mt-6 flex items-start gap-3 border-t border-border pt-5 text-xs text-muted">
            <Lock size={15} className="mt-0.5 shrink-0" />
            Browser geolocation permission will be requested on the next step to
            validate on-site geofence presence.
          </div>
        </form>
      </div>
    </main>
  );
}
