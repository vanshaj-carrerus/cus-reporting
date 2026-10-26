import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/adminAuth";
import { findLatestApk } from "@/lib/apk";
import { getRelease, isValidVersion } from "@/lib/appVersion";
import { connectToDatabase } from "@/lib/mongodb";
import {
  AppRelease,
  APP_UPDATE_MESSAGE_MAX_LENGTH,
  APP_UPDATE_URL_MAX_LENGTH,
} from "@/models/AppRelease";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

// GET /api/app-release — the newest app version the admin has set.
export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;
  try {
    await connectToDatabase();
    return NextResponse.json({ release: await getRelease() });
  } catch (error) {
    console.error("GET /api/app-release failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// PUT /api/app-release — body { latestVersion, updateUrl, message }. An empty
// latestVersion switches the update notice off.
export async function PUT(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  let body: { latestVersion?: unknown; updateUrl?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const latestVersion = typeof body.latestVersion === "string" ? body.latestVersion.trim() : "";
  if (latestVersion && !isValidVersion(latestVersion)) {
    return NextResponse.json(
      { error: "The version must be numbers separated by dots, like 1.2.0." },
      { status: 400 }
    );
  }
  const updateUrl = typeof body.updateUrl === "string" ? body.updateUrl.trim() : "";
  if (updateUrl) {
    let valid = updateUrl.length <= APP_UPDATE_URL_MAX_LENGTH;
    try {
      valid = valid && ["https:", "http:"].includes(new URL(updateUrl).protocol);
    } catch {
      valid = false;
    }
    if (!valid) {
      return NextResponse.json({ error: "The download link must be a valid http(s) URL." }, { status: 400 });
    }
  }
  if (latestVersion && !updateUrl && !(await findLatestApk())) {
    return NextResponse.json(
      {
        error:
          "Add a download link, or upload the APK to public/apk/latest so /download can serve it.",
      },
      { status: 400 }
    );
  }
  const message = typeof body.message === "string" ? body.message.trim().replace(/\s+/g, " ") : "";
  if (message.length > APP_UPDATE_MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `The message must be at most ${APP_UPDATE_MESSAGE_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();
    await AppRelease.updateOne(
      { key: "default" },
      { $set: { latestVersion, updateUrl, message } },
      { upsert: true }
    );
    return NextResponse.json({ release: { latestVersion, updateUrl, message } });
  } catch (error) {
    console.error("PUT /api/app-release failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
