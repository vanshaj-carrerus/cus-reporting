import { createReadStream } from "fs";
import { Readable } from "stream";
import { NextResponse } from "next/server";
import { findLatestApk } from "@/lib/apk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /download — public link employees open on their phone. Sends the newest APK
// from public/apk/latest as a download.
export async function GET() {
  const apk = await findLatestApk();
  if (!apk) {
    return NextResponse.json(
      { error: "No app file has been uploaded yet. Please ask your admin." },
      { status: 404 }
    );
  }

  const stream = Readable.toWeb(createReadStream(apk.filePath)) as ReadableStream;
  const safeName = apk.fileName.replace(/[^\w.\- ]/g, "_");
  return new Response(stream, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(apk.size),
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}
