import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/adminAuth";
import { isDuplicateKeyError } from "@/lib/mongoErrors";
import { connectToDatabase } from "@/lib/mongodb";
import { officeJson, parseOfficeBody } from "@/lib/officeInput";
import { Office, OFFICE_COLLATION } from "@/models/Office";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

// GET /api/offices — every place employees can check in from.
export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  try {
    await connectToDatabase();
    const offices = await Office.find().sort({ name: 1 }).collation(OFFICE_COLLATION).lean();
    return NextResponse.json({ offices: offices.map(officeJson) });
  } catch (error) {
    console.error("GET /api/offices failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// POST /api/offices — body { name, latitude, longitude, radiusMeters }.
export async function POST(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = parseOfficeBody(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const duplicate = () =>
    NextResponse.json(
      { error: `An office named "${parsed.values.name}" already exists.` },
      { status: 409 }
    );

  try {
    await connectToDatabase();
    const clash = await Office.findOne({ name: parsed.values.name }).collation(OFFICE_COLLATION);
    if (clash) return duplicate();

    const office = await Office.create(parsed.values);
    return NextResponse.json({ office: officeJson(office) }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) return duplicate();
    console.error("POST /api/offices failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
