import { Attendance } from "@/models/Attendance";
import { BreakPlan } from "@/models/BreakPlan";
import "@/models/Department";
import { Employee } from "@/models/Employee";
import { Shift } from "@/models/Shift";
import { getShiftSettings, instanceOfAttendance, breaksFor, type LoadedPlan, type LoadedShift } from "./employeeSchedule";
import { classifyPresence, type PresenceState } from "./shifts";
import { istDateKey, istDayRange } from "./time";

export interface LivePresenceRow {
  attendanceId: string;
  employeeId: string;
  name: string;
  department: string | null;
  shift: string | null;
  state: PresenceState;
  /** When they left the office area (outside states). */
  outsideSince: string | null;
  /** When the break they overstayed ended (BREAK_OVERRUN). */
  overrunSince: string | null;
  lastSeenAt: string | null;
  /** Last reported position while outside the office areas; null when inside. */
  latitude: number | null;
  longitude: number | null;
  /** The employee's phone is registered to receive an admin alert. */
  canAlert: boolean;
  outsideMinutes: number;
  breakOverrunMinutes: number;
}

/** Everyone who is checked in and still on shift right now, with where they stand. */
export async function getLivePresence(now: Date = new Date()): Promise<LivePresenceRow[]> {
  const settings = await getShiftSettings();
  const today = istDayRange(istDateKey(now));

  const open = await Attendance.find({
    status: { $ne: "OUT_OF_LOCATION" },
    checkOutTime: null,
    $or: [
      { shiftEnd: { $gt: now }, shiftStart: { $lte: now } },
      { shiftEnd: { $exists: false }, checkInTime: { $gte: today.start, $lt: today.end } },
    ],
  }).lean();
  if (open.length === 0) return [];

  const employees = await Employee.find({ _id: { $in: open.map((a) => a.userId) } })
    .select("+pushToken")
    .populate("department", "name")
    .lean();
  const employeeById = new Map(employees.map((e) => [e._id.toString(), e]));

  const shiftIds = employees.map((e) => e.shift).filter(Boolean);
  const planIds = employees.map((e) => e.breakPlan).filter(Boolean);
  const [shifts, plans] = await Promise.all([
    Shift.find({ _id: { $in: shiftIds } }).lean(),
    BreakPlan.find({ _id: { $in: planIds } }).lean(),
  ]);
  const shiftById = new Map<string, LoadedShift>(
    shifts.map((s) => [
      s._id.toString(),
      { id: s._id.toString(), name: s.name, startTime: s.startTime, endTime: s.endTime, lateGraceMinutes: s.lateGraceMinutes },
    ])
  );
  const planById = new Map<string, LoadedPlan>(
    plans.map((p) => [p._id.toString(), { id: p._id.toString(), name: p.name, breaks: p.breaks }])
  );

  const rows: LivePresenceRow[] = [];
  for (const a of open) {
    const employee = employeeById.get(a.userId.toString());
    if (!employee) continue;
    const shift = employee.shift ? (shiftById.get(employee.shift.toString()) ?? null) : null;
    const plan = employee.breakPlan ? (planById.get(employee.breakPlan.toString()) ?? null) : null;
    const instance = instanceOfAttendance(a);

    const { state, overrunSince } = classifyPresence({
      now,
      shift: instance,
      breaks: breaksFor(plan, shift, instance),
      inside: a.lastSeenInside ?? null,
      outsideSince: a.outsideSince ?? null,
      lastSeenAt: a.lastSeenAt ?? null,
      noSignalMinutes: settings.noSignalMinutes,
      checkedOut: false,
    });

    rows.push({
      attendanceId: a._id.toString(),
      employeeId: employee._id.toString(),
      name: employee.name,
      department: (employee.department as { name?: string } | null)?.name ?? null,
      shift: a.shiftName ?? null,
      state,
      outsideSince: a.outsideSince?.toISOString() ?? null,
      overrunSince: overrunSince?.toISOString() ?? null,
      lastSeenAt: a.lastSeenAt?.toISOString() ?? null,
      latitude: a.lastSeenInside === false ? (a.lastLatitude ?? null) : null,
      longitude: a.lastSeenInside === false ? (a.lastLongitude ?? null) : null,
      canAlert: Boolean(employee.pushToken),
      outsideMinutes: Math.round(a.outsideMinutes ?? 0),
      breakOverrunMinutes: Math.round(a.breakOverrunMinutes ?? 0),
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
