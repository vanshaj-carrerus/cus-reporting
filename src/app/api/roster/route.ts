import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";

// GET /api/roster — public list of employee ids + names for the check-in
// picker (the mobile app's equivalent of the server-rendered /checkin page).
// Deliberately not behind admin auth, and exposes nothing beyond what /checkin
// already shows. Employee records hold only a name, so nothing else leaks.
export async function GET() {
  try {
    await connectToDatabase();
    const employees = await Employee.find().sort({ name: 1 }).lean();

    return NextResponse.json({
      employees: employees.map((employee) => ({
        id: employee._id.toString(),
        name: employee.name,
      })),
    });
  } catch (error) {
    console.error("GET /api/roster failed:", error);
    return NextResponse.json(
      { error: "Couldn't reach the database. Please try again in a moment." },
      { status: 500 }
    );
  }
}
