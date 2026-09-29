import Image from "next/image";
import Link from "next/link";

export const BRAND_NAME = "CareerUS Solutions";

// The site is dark, so the header uses the white-text logo.
export function Brand() {
  return (
    <Link href="/" aria-label={BRAND_NAME} className="flex items-center">
      <Image
        src="/logo-light.png"
        alt={BRAND_NAME}
        width={4433}
        height={1439}
        priority
        className="h-8 w-auto"
      />
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
