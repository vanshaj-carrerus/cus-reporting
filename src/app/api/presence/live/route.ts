import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/adminAuth";
import { getLivePresence } from "@/lib/livePresence";
import { connectToDatabase } from "@/lib/mongodb";

// GET /api/presence/live — everyone checked in and on shift right now, with
// their state (inside / on break / outside / break overrun / no signal).
export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  try {
    await connectToDatabase();
    return NextResponse.json({ rows: await getLivePresence(), at: new Date().toISOString() });
  } catch (error) {
    console.error("GET /api/presence/live failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
