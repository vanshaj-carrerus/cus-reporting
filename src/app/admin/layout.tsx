import { Brand, SiteFooter } from "@/components/Brand";
import { isAdmin } from "@/lib/adminAuth";
import AdminNav from "./AdminNav";
import SignOutButton from "./SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Only for showing the nav — access itself is enforced by proxy.ts and by
  // requireAdmin() in each page (layouts don't re-run on client navigation).
  const signedIn = await isAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-3.5">
          <Brand />
          {signedIn && (
            <div className="flex items-center gap-3">
              <AdminNav />
              <SignOutButton />
            </div>
          )}
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
