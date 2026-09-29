import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const BRAND_NAME = "CUS Reporting";

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent/30 bg-accent/10 text-accent-text">
        <ShieldCheck size={16} />
      </span>
      {BRAND_NAME}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-6 py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span className="font-mono">
          © {new Date().getFullYear()} {BRAND_NAME} Systems Inc. Precision Geofence &amp; Attendance.
        </span>
        <span className="font-mono">Geofence-verified · Auto-classified</span>
      </div>
    </footer>
  );
}
