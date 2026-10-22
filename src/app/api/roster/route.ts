import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";

// GET /api/roster — public list of employee ids + names for the check-in
// picker (the mobile app's equivalent of the server-rendered /checkin page).
// Deliberately not behind admin auth, and exposes nothing beyond what /checkin
// already shows. Employee records hold only a name, so nothing else leaks.
//
// CORS: the Expo app also runs in a browser (web), where cross-origin reads need
// these headers. Safe to open to any origin because the data is public and the
// client fetches it without credentials.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    await connectToDatabase();
    const employees = await Employee.find().sort({ name: 1 }).lean();

    return NextResponse.json(
      {
        employees: employees.map((employee) => ({
          id: employee._id.toString(),
          name: employee.name,
        })),
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error("GET /api/roster failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
