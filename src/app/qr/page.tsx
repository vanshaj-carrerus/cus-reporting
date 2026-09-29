import { headers } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { AlertTriangle, ScanLine, Smartphone, MapPin, CheckCircle2 } from "lucide-react";
import { Brand, BRAND_NAME } from "@/components/Brand";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Scan to Check In",
};

// Works out the public address of this site so the QR points somewhere a
// phone can actually reach. APP_URL wins if set (recommended in production).
async function getCheckInUrl(): Promise<string> {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return `${configured}/checkin`;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const isLocal = /^(localhost|127\.|\[::1\])/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (isLocal ? "http" : "https");
  return `${proto}://${host}/checkin`;
}

const STEPS = [
  { icon: Smartphone, text: "Scan the code with your phone camera" },
  { icon: ScanLine, text: "Pick your name from the list" },
  { icon: MapPin, text: "Allow location so we can confirm you're on site" },
  { icon: CheckCircle2, text: "You're checked in for the day" },
];

export default async function QrPage() {
  const url = await getCheckInUrl();
  const svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 1,
    color: { dark: "#0b1220", light: "#ffffff" },
  });
  const isLocalhost = /\/\/(localhost|127\.|\[::1\])/.test(url);

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-8 print:bg-white print:text-black">
      <div aria-hidden className="bg-grid pointer-events-none absolute inset-0 -z-10 print:hidden" />

      <div className="flex w-full max-w-md items-center justify-between print:hidden">
        <Brand />
        <Link
          href="/checkin"
          className="transition-smooth text-sm text-muted hover:text-foreground"
        >
          Open check-in
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center py-8">
        <div className="animate-scale-in w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-2xl shadow-black/40 print:border-0 print:bg-white print:shadow-none">
          {/* Dark-text logo for the printed sheet (the on-screen header has the light one). */}
          <Image
            src="/logo.png"
            alt={BRAND_NAME}
            width={4432}
            height={1440}
            className="mx-auto mb-6 hidden h-14 w-auto print:block"
          />
          <p className="font-mono text-[11px] uppercase tracking-wider text-accent-text print:text-black">
            Daily attendance
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Scan to check in</h1>
          <p className="mt-1.5 text-sm text-muted print:text-black">
            Scan this code every day when you arrive at the office.
          </p>

          <div
            role="img"
            aria-label={`QR code linking to ${url}`}
            className="relative mx-auto mt-6 w-full max-w-64 overflow-hidden rounded-2xl border-4 border-white bg-white"
          >
            <div
              className="[&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            {/* Logo in the middle. Error correction is "H", which tolerates ~30% of the code
                being covered; this badge hides well under 10%. */}
            <div className="absolute left-1/2 top-1/2 flex h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg bg-white p-[2.5%]">
              <Image
                src="/favicon.png"
                alt=""
                width={180}
                height={180}
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          <p className="mt-4 break-all font-mono text-xs text-muted print:text-black">{url}</p>

          {isLocalhost && (
            <p
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-left text-xs text-warning print:hidden"
            >
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                This address only works on this computer. Phones can&apos;t open
                &ldquo;localhost&rdquo;. Set <code className="font-mono">APP_URL</code> in
                .env to your public address (or your computer&apos;s network
                address) and restart, then print this page.
              </span>
            </p>
          )}

          <ol className="mt-6 space-y-2.5 border-t border-border pt-6 text-left text-sm">
            {STEPS.map((step, i) => (
              <li key={step.text} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent-text print:border-black/20 print:bg-white print:text-black">
                  <step.icon size={14} />
                </span>
                <span>
                  <span className="mr-1.5 font-mono text-xs text-muted print:text-black">{i + 1}.</span>
                  {step.text}
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-6 print:hidden">
            <PrintButton />
          </div>
        </div>
      </div>
    </main>
  );
}
