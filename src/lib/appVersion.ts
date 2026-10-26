import { AppRelease } from "@/models/AppRelease";

const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;

export function isValidVersion(value: unknown): value is string {
  return typeof value === "string" && VERSION_PATTERN.test(value.trim());
}

/** Negative if a < b, 0 if equal, positive if a > b. Compares dotted numbers ("1.10.0" > "1.9.0"). */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export interface Release {
  latestVersion: string;
  updateUrl: string;
  message: string;
}

/** The release the admin has set (empty fields if none yet). Call after connecting. */
export async function getRelease(): Promise<Release> {
  const doc = await AppRelease.findOne({ key: "default" }).lean();
  return {
    latestVersion: doc?.latestVersion ?? "",
    updateUrl: doc?.updateUrl ?? "",
    message: doc?.message ?? "",
  };
}

/** True if `appVersion` is older than the release's latest (an unknown version counts as older). */
export function isOutdated(release: Release, appVersion: string | null | undefined): boolean {
  if (!release.latestVersion) return false;
  if (!appVersion || !isValidVersion(appVersion)) return true;
  return compareVersions(appVersion, release.latestVersion) < 0;
}

/** What the app is told: whether to show an "update available" notice, and how. */
export function updateNotice(
  release: Release,
  appVersion: string | null | undefined,
  fallbackUrl: string | null = null
) {
  return {
    available: isOutdated(release, appVersion),
    latestVersion: release.latestVersion || null,
    url: release.updateUrl || fallbackUrl,
    message: release.message || null,
  };
}
