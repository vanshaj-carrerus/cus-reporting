import { promises as fs } from "fs";
import path from "path";
import { compareVersions } from "./appVersion";

// The newest build of the employee app is dropped in this folder by hand, e.g.
// public/apk/latest/cus-shift-v1.2.0.apk, and served by GET /download.
export const APK_DIR = path.join(process.cwd(), "public", "apk", "latest");

export interface ApkFile {
  fileName: string;
  filePath: string;
  size: number;
  /** The version found in the file name ("1.2.0"), if any. */
  version: string | null;
}

function versionInName(fileName: string): string | null {
  return fileName.match(/(\d+(?:\.\d+){1,3})/)?.[1] ?? null;
}

/**
 * The APK to hand out: the one with the highest version in its name, or the most
 * recently added if names carry no version. Null if the folder is empty or missing.
 */
export async function findLatestApk(): Promise<ApkFile | null> {
  let names: string[];
  try {
    names = (await fs.readdir(APK_DIR)).filter((n) => n.toLowerCase().endsWith(".apk"));
  } catch {
    return null;
  }

  const files: (ApkFile & { mtime: number })[] = [];
  for (const fileName of names) {
    const filePath = path.join(APK_DIR, fileName);
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat?.isFile()) continue;
    files.push({
      fileName,
      filePath,
      size: stat.size,
      version: versionInName(fileName),
      mtime: stat.mtimeMs,
    });
  }
  if (files.length === 0) return null;

  files.sort((a, b) => {
    if (a.version && b.version) {
      const byVersion = compareVersions(b.version, a.version);
      if (byVersion !== 0) return byVersion;
    } else if (a.version || b.version) {
      return a.version ? -1 : 1;
    }
    return b.mtime - a.mtime;
  });
  const { fileName, filePath, size, version } = files[0];
  return { fileName, filePath, size, version };
}
