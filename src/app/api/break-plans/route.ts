import { NextRequest, NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/adminAuth";
import { parseBreaks, parsePlanName } from "@/lib/breakPlanInput";
import { isDuplicateKeyError } from "@/lib/mongoErrors";
import { connectToDatabase } from "@/lib/mongodb";
import { BreakPlan, BREAK_PLAN_COLLATION } from "@/models/BreakPlan";
import { Employee } from "@/models/Employee";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

// GET /api/break-plans — all plans (with their fixed break windows) and how many
// employees use each.
export async function GET(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  try {
    await connectToDatabase();
    const [plans, counts] = await Promise.all([
      BreakPlan.find().sort({ name: 1 }).collation(BREAK_PLAN_COLLATION).lean(),
      Employee.aggregate([{ $group: { _id: "$breakPlan", count: { $sum: 1 } } }]),
    ]);
    const countById = new Map(counts.map((c) => [String(c._id), c.count as number]));
    return NextResponse.json({
      plans: plans.map((p) => ({
        _id: p._id.toString(),
        name: p.name,
        breaks: p.breaks,
        employeeCount: countById.get(p._id.toString()) ?? 0,
      })),
    });
  } catch (error) {
    console.error("GET /api/break-plans failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// POST /api/break-plans — body { name, breaks: [{ name, startTime, endTime }] } (IST HH:mm).
export async function POST(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  let body: { name?: unknown; breaks?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const planName = parsePlanName(body.name);
  if ("error" in planName) return NextResponse.json({ error: planName.error }, { status: 400 });
  const parsed = parseBreaks(body.breaks ?? []);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const { name } = planName;
  const duplicate = () =>
    NextResponse.json({ error: `A break plan named "${name}" already exists.` }, { status: 409 });

  try {
    await connectToDatabase();
    if (await BreakPlan.findOne({ name }).collation(BREAK_PLAN_COLLATION)) return duplicate();

    const plan = await BreakPlan.create({ name, breaks: parsed.breaks });
    return NextResponse.json({ plan: { _id: plan._id.toString() } }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) return duplicate();
    console.error("POST /api/break-plans failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
