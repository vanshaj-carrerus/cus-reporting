import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/employeeAuth";
import { isExpoPushToken } from "@/lib/pushNotify";
import { Employee } from "@/models/Employee";

const DB_ERROR = "Couldn't reach the database. Please try again in a moment.";

// POST /api/push-token — body { token }. The signed-in employee's phone registers
// where admin alerts should be delivered. A token belongs to one employee: if the
// phone was used by someone else before, it moves.
export async function POST(request: NextRequest) {
  try {
    const auth = await requireEmployee(request);
    if ("denied" in auth) return auth.denied;

    let body: { token?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
    }
    if (!isExpoPushToken(body.token)) {
      return NextResponse.json({ error: "A valid push token is required." }, { status: 400 });
    }

    await Employee.updateMany(
      { pushToken: body.token, _id: { $ne: auth.employee._id } },
      { $unset: { pushToken: 1 } }
    );
    await Employee.updateOne({ _id: auth.employee._id }, { $set: { pushToken: body.token } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/push-token failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}

// DELETE /api/push-token — the employee signed out; stop alerting this phone.
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireEmployee(request);
    if ("denied" in auth) return auth.denied;
    await Employee.updateOne({ _id: auth.employee._id }, { $unset: { pushToken: 1 } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/push-token failed:", error);
    return NextResponse.json({ error: DB_ERROR }, { status: 500 });
  }
}
