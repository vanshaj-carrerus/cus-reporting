import { requireAdmin } from "@/lib/adminAuth";
import { findLatestApk } from "@/lib/apk";
import { compareVersions, getRelease, isOutdated } from "@/lib/appVersion";
import { agoText, lastActivity } from "@/lib/inactivity";
import { connectToDatabase } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";
import ReleaseForm from "./ReleaseForm";
import { Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminAppPage() {
  await requireAdmin();
  await connectToDatabase();

  const [release, apk, employees] = await Promise.all([
    getRelease(),
    findLatestApk(),
    Employee.find({ passwordSetAt: { $exists: true } })
      .sort({ name: 1 })
      .lean() as Promise<
      {
        _id: { toString(): string };
        name: string;
        appVersion?: string;
        appPlatform?: string;
        lastActiveAt?: Date;
        passwordSetAt?: Date;
      }[]
    >,
  ]);

  const outdated = employees.filter((e) => isOutdated(release, e.appVersion));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">App version</h1>
        <p className="text-sm text-muted">
          Set the newest version of the employee app. Anyone on an older version sees an
          &quot;update available&quot; notice in the app with your download link, and appears below.
        </p>
      </div>

      <div className="animate-fade-in-up mb-6 rounded-xl border border-border bg-surface p-4 text-sm">
        <div className="mb-1 font-medium">Download link for employees</div>
        <p className="font-mono text-xs text-accent-text">/download</p>
        <p className="mt-1 text-xs text-muted">
          Opening it downloads the newest APK from{" "}
          <span className="font-mono">public/apk/latest/</span> (e.g.{" "}
          <span className="font-mono">cus-shift-v1.2.0.apk</span>). Leave the download link below
          empty to use it.
        </p>
        {apk ? (
          <p className="mt-2 text-xs">
            Ready to download: <span className="font-mono">{apk.fileName}</span> (
            {(apk.size / 1024 / 1024).toFixed(1)} MB)
            {release.latestVersion && apk.version && compareVersions(apk.version, release.latestVersion) !== 0 && (
              <span className="ml-2 text-warning">
                The file is v{apk.version} but the newest version is set to {release.latestVersion}.
              </span>
            )}
          </p>
        ) : (
          <p className="mt-2 text-xs text-warning">No APK uploaded yet — nothing to download.</p>
        )}
      </div>

      <ReleaseForm
        latestVersion={release.latestVersion}
        updateUrl={release.updateUrl}
        message={release.message}
      />

      {release.latestVersion && (
        <div className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Smartphone size={15} className={outdated.length ? "text-warning" : "text-success"} />
            <h2 className="text-sm font-semibold">
              {outdated.length === 0
                ? `Everyone is on ${release.latestVersion}`
                : `${outdated.length} of ${employees.length} on an older version`}
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {outdated.map((e) => {
              const last = lastActivity(e);
              return (
                <li key={e._id.toString()} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-40 flex-1 font-medium">{e.name}</div>
                  <div className="text-xs text-warning">
                    {e.appVersion
                      ? `v${e.appVersion}${e.appPlatform ? ` · ${e.appPlatform}` : ""}`
                      : "Old version (hasn't reported one)"}
                  </div>
                  <div className="text-xs text-muted">
                    {last ? `Last active ${agoText(last)}` : "Never signed in"}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </main>
  );
}
