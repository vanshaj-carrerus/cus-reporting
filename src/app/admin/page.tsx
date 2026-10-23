import { requireAdmin } from "@/lib/adminAuth";
import { attendanceDayFilter } from "@/lib/attendanceDay";
import { getLivePresence } from "@/lib/livePresence";
import { connectToDatabase } from "@/lib/mongodb";
import {
  formatIstDate,
  formatIstTime,
  istDateKey,
  parseDateKey,
} from "@/lib/time";
import { Attendance, type AttendanceStatus } from "@/models/Attendance";
import LivePresencePanel from "./LivePresencePanel";
import { Department, DEPARTMENT_COLLATION } from "@/models/Department";
import { Employee } from "@/models/Employee";
import type { EmployeeDoc } from "@/models/Employee";
import { Types } from "mongoose";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  MapPinOff,
  ExternalLink,
} from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<AttendanceStatus, string> = {
  ON_TIME: "border-accent/30 bg-success-bg text-success",
  LATE: "border-warning/30 bg-warning-bg text-warning",
  OUT_OF_LOCATION: "border-danger/30 bg-danger-bg text-danger",
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  ON_TIME: "On Time",
  LATE: "Late",
  OUT_OF_LOCATION: "Out of Location",
};

interface PopulatedAttendance {
  _id: Types.ObjectId;
  userId:
    | (Omit<EmployeeDoc, "department"> & {
        _id: Types.ObjectId;
        department?: { _id: Types.ObjectId; name: string } | null;
      })
    | null;
  checkInTime: Date;
  latitude: number;
  longitude: number;
  status: AttendanceStatus;
  distanceFromOffice: number;
  shiftName?: string;
  outsideMinutes?: number;
  breakOverrunMinutes?: number;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; department?: string }>;
}) {
  await requireAdmin();
  const { date, department } = await searchParams;
  // The selected day is an IST calendar day; junk or missing input means today (IST).
  const dateInputValue = (date && parseDateKey(date)) || istDateKey();

  await connectToDatabase();

  const departments = await Department.find()
    .sort({ name: 1 })
    .collation(DEPARTMENT_COLLATION)
    .lean();

  // "all" (default) shows everyone; "none" is employees without a department;
  // otherwise it must be the id of an existing department.
  const departmentFilter =
    department === "none" ||
    (department && departments.some((d) => d._id.toString() === department))
      ? department
      : "all";

  // An attendance "day" is the day its shift started (so night shifts stay whole).
  const filter: Record<string, unknown> = { ...attendanceDayFilter(dateInputValue) };
  if (departmentFilter !== "all") {
    const members = await Employee.find({
      department: departmentFilter === "none" ? null : departmentFilter,
    }).distinct("_id");
    filter.userId = { $in: members };
  }

  const records = (await Attendance.find(filter)
    .populate({ path: "userId", populate: { path: "department", select: "name" } })
    .sort({ checkInTime: -1 })
    .lean()) as unknown as PopulatedAttendance[];

  const departmentLabel =
    departmentFilter === "none"
      ? "Unassigned"
      : (departments.find((d) => d._id.toString() === departmentFilter)?.name ?? "");

  // Live presence (who is outside the office right now), narrowed to the chosen department.
  const liveRows = (await getLivePresence()).filter((r) =>
    departmentFilter === "all"
      ? true
      : departmentFilter === "none"
        ? r.department === null
        : r.department === departmentLabel
  );
  const liveAt = new Date().toISOString();

  const stats = [
    {
      label: "Total check-ins",
      value: records.length,
      icon: CalendarDays,
      accent: "text-accent-text bg-accent/10",
    },
    {
      label: "On time",
      value: records.filter((r) => r.status === "ON_TIME").length,
      icon: CheckCircle2,
      accent: "text-success bg-success-bg",
    },
    {
      label: "Late",
      value: records.filter((r) => r.status === "LATE").length,
      icon: Clock,
      accent: "text-warning bg-warning-bg",
    },
    {
      label: "Out of location",
      value: records.filter((r) => r.status === "OUT_OF_LOCATION").length,
      icon: MapPinOff,
      accent: "text-danger bg-danger-bg",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="animate-fade-in-up mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Attendance Dashboard</h1>
          <p className="text-sm text-muted">
            {formatIstDate(dateInputValue)} · IST
            {departmentFilter !== "all" && ` · ${departmentLabel}`}
          </p>
        </div>
        <form method="GET" className="flex flex-wrap items-center gap-2">
          <select
            name="department"
            defaultValue={departmentFilter}
            aria-label="Filter by department"
            className="transition-smooth rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d._id.toString()} value={d._id.toString()}>
                {d.name}
              </option>
            ))}
            <option value="none">Unassigned</option>
          </select>
          <input
            type="date"
            name="date"
            defaultValue={dateInputValue}
            className="transition-smooth rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          <button
            type="submit"
            className="transition-smooth rounded-xl bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent-hover active:scale-[0.98]"
          >
            View
          </button>
        </form>
      </div>

      <LivePresencePanel initialRows={liveRows} initialAt={liveAt} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="animate-fade-in-up rounded-xl border border-border bg-surface p-5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div
              className={`mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg ${stat.accent}`}
            >
              <stat.icon size={16} />
            </div>
            <div className="text-3xl font-semibold">{stat.value}</div>
            <div className="text-xs text-muted">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-2/60">
            <tr>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Employee
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Department
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Shift
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Check-In Time
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Coordinates
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Distance
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Away (not on break)
              </th>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {records.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted">
                  No check-ins for this date{departmentFilter !== "all" ? " in this department" : ""}.
                </td>
              </tr>
            )}
            {records.map((record, i) => {
              const mapsUrl = `https://www.google.com/maps?q=${record.latitude},${record.longitude}`;
              const atOffice = record.status !== "OUT_OF_LOCATION";
              return (
                <tr
                  key={record._id.toString()}
                  className={`animate-fade-in-up transition-smooth hover:bg-surface-2 ${record.status === "OUT_OF_LOCATION" ? "bg-danger-bg/40" : ""}`}
                  style={{ animationDelay: `${i * 30}ms` }}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {record.userId?.name ?? "Unknown employee"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {record.userId?.department?.name ?? "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-muted">{record.shiftName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {formatIstTime(record.checkInTime)}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-smooth inline-flex items-center gap-1 font-mono text-xs text-accent-text hover:text-accent-hover hover:underline"
                    >
                      {atOffice ? <MapPin size={13} /> : <MapPinOff size={13} />}
                      {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
                      <ExternalLink size={11} />
                    </a>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {Math.round(record.distanceFromOffice)}m
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {Math.round(record.outsideMinutes ?? 0)} min
                    {(record.breakOverrunMinutes ?? 0) >= 1 && (
                      <span className="block text-xs text-danger">
                        {Math.round(record.breakOverrunMinutes ?? 0)} min after break
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[record.status]}`}
                    >
                      {STATUS_LABELS[record.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
