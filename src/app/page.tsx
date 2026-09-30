import Link from "next/link";
import {
  MapPinned,
  Gauge,
  ArrowRight,
  ShieldCheck,
  ScanLine,
  UserCheck,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import { Brand, SiteFooter } from "@/components/Brand";

const FEATURES = [
  {
    icon: UserCheck,
    title: "Roster check-in",
    description:
      "Only employees added by an admin can check in — no free-text IDs, no shared logins.",
    footer: "Admin-managed roster",
  },
  {
    icon: MapPinned,
    title: "Geo-fenced",
    description:
      "Haversine-based location validation rejects check-ins made outside the office perimeter.",
    footer: "Live GPS verification",
  },
  {
    icon: Gauge,
    title: "Smart status",
    description:
      "On Time, Late, or Out of Location — assigned automatically the moment you check in.",
    footer: "Zero manual review",
  },
];

// Illustrative preview only — the real log lives on the admin dashboard.
const PREVIEW_ROWS = [
  { name: "Elena Rostova", time: "08:59:42 AM", tag: "On Time", zone: "12m from office", tone: "accent" },
  { name: "Marcus Vance", time: "09:22:11 AM", tag: "Late", zone: "28m from office", tone: "warning" },
  { name: "David Cho", time: "08:58:05 AM", tag: "On Time", zone: "8m from office", tone: "accent" },
] as const;

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
          <Brand />
          <div className="flex items-center gap-2">
            <Link
              href="/checkin"
              className="transition-smooth inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98]"
            >
              Launch Check-In
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden px-6 pb-24 pt-16">
        <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(50% 40% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent)",
          }}
        />

        <section className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="animate-fade-in-up mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-accent-text">
            <ShieldCheck size={13} />
            Secure, automated, tamper-resistant
          </div>
          <h1
            className="animate-fade-in-up text-balance text-4xl font-semibold tracking-tight sm:text-6xl"
            style={{ animationDelay: "80ms" }}
          >
            Attendance verification
            <span className="block text-accent-text">powered by real-time geofencing</span>
          </h1>

          <p
            className="animate-fade-in-up mt-6 max-w-xl text-balance text-muted"
            style={{ animationDelay: "160ms" }}
          >
            Eliminate buddy punching and time theft. Employees check in from
            their own device, their location is validated against the office
            perimeter, and status is assigned automatically.
          </p>

          <div
            className="animate-fade-in-up mt-9 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "240ms" }}
          >
            <Link
              href="/checkin"
              className="transition-smooth glow-accent group inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98]"
            >
              <ScanLine size={16} />
              Employee Check-In
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </div>
        </section>

        {/* Illustrative preview panel */}
        <section
          className="animate-fade-in-up mx-auto mt-16 w-full max-w-3xl rounded-2xl border border-border bg-surface/80 p-5 shadow-2xl shadow-black/40"
          style={{ animationDelay: "320ms" }}
        >
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
                <span className="h-2.5 w-2.5 rounded-full bg-border" />
              </div>
              <span className="font-mono text-xs text-muted">RECENT CHECK-INS · SAMPLE</span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent-text">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Live
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-background">
              <div className="absolute h-28 w-28 rounded-full border border-accent/30" />
              <div className="absolute h-44 w-44 rounded-full border border-accent/15" />
              <div className="animate-radar absolute h-44 w-44 rounded-full bg-[conic-gradient(from_0deg,transparent_70%,color-mix(in_srgb,var(--accent)_35%,transparent))]" />
              <MapPin size={22} className="relative text-accent-text" />
              <span className="absolute bottom-3 left-3 font-mono text-[10px] text-muted">
                Perimeter: <span className="text-accent-text">Within range</span>
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {PREVIEW_ROWS.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2
                      size={18}
                      className={row.tone === "warning" ? "text-warning" : "text-accent-text"}
                    />
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        {row.name}
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                            row.tone === "warning"
                              ? "bg-warning-bg text-warning"
                              : "bg-accent/10 text-accent-text"
                          }`}
                        >
                          {row.tag}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-muted">{row.zone}</div>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-muted">{row.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto mt-24 max-w-5xl">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Built for certainty</h2>
            <p className="mt-2 text-sm text-muted">
              Replace time-clock cards and easily spoofed sign-in sheets.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="transition-smooth flex flex-col rounded-2xl border border-border bg-surface p-6 hover:-translate-y-0.5 hover:border-accent/40"
              >
                <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent-text">
                  <feature.icon size={18} />
                </div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-1.5 flex-1 text-sm text-muted">{feature.description}</p>
                <div className="mt-5 border-t border-border pt-3 font-mono text-xs text-muted">
                  {feature.footer}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
