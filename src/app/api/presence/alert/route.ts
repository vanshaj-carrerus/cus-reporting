import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminApiGuard } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { sendPush } from "@/lib/pushNotify";
import { Employee } from "@/models/Employee";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";
const MESSAGE_MAX_LENGTH = 200;
const DEFAULT_MESSAGE = "Your admin is asking you to return to the office.";
// Must match ALERT_CHANNEL in the app (cus-shift/src/lib/notifications.ts).
const ALERT_CHANNEL = "outside-alert-v1";

// POST /api/presence/alert — body { employeeId, message? }. The admin sends a
// notification to one employee's phone.
export async function POST(request: NextRequest) {
  const denied = adminApiGuard(request);
  if (denied) return denied;

  let body: { employeeId?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (typeof body.employeeId !== "string" || !Types.ObjectId.isValid(body.employeeId)) {
    return NextResponse.json({ error: "Invalid employee id." }, { status: 400 });
  }
  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message.trim().replace(/\s+/g, " ")
      : DEFAULT_MESSAGE;
  if (message.length > MESSAGE_MAX_LENGTH) {
    return NextResponse.json(
      { error: `The message must be at most ${MESSAGE_MAX_LENGTH} characters.` },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();
    const employee = await Employee.findById(body.employeeId).select("name +pushToken");
    if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    if (!employee.pushToken) {
      return NextResponse.json(
        {
          error: `${employee.name}'s phone isn't set up for alerts yet (they need to open the app and allow notifications).`,
        },
        { status: 409 }
      );
    }

    const result = await sendPush(employee.pushToken, {
      title: "Message from your admin",
      body: message,
      channelId: ALERT_CHANNEL,
      data: { type: "admin-alert" },
    });
    if (result.ok) return NextResponse.json({ success: true });

    if (result.reason === "unregistered") {
      await Employee.updateOne({ _id: employee._id }, { $unset: { pushToken: 1 } });
      return NextResponse.json(
        { error: `${employee.name}'s phone can't receive alerts any more (the app was removed or signed out).` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: result.message }, { status: 502 });
  } catch (error) {
    console.error("POST /api/presence/alert failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
