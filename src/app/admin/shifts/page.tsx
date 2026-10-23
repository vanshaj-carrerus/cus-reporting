import { requireAdmin } from "@/lib/adminAuth";
import { getShiftSettings } from "@/lib/employeeSchedule";
import { connectToDatabase } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";
import { Shift } from "@/models/Shift";
import AddShiftForm from "./AddShiftForm";
import SettingsForm from "./SettingsForm";
import ShiftRow from "./ShiftRow";
import { Clock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminShiftsPage() {
  await requireAdmin();
  await connectToDatabase();

  const [shifts, counts, settings] = await Promise.all([
    Shift.find().sort({ startTime: 1, name: 1 }).lean(),
    Employee.aggregate([{ $group: { _id: "$shift", count: { $sum: 1 } } }]),
    getShiftSettings(),
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count as number]));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Shifts</h1>
        <p className="text-sm text-muted">
          All times are Indian Standard Time (IST). A shift that ends at or before its start time
          runs past midnight (a night shift). Assign shifts to employees on the Employees tab.
        </p>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <AddShiftForm />
      </div>

      <div
        className="animate-fade-in-up mb-8 overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        style={{ animationDelay: "120ms" }}
      >
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-2/60">
            <tr>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Shift
              </th>
              <th className="px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shifts.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center text-muted">
                    <Clock size={20} />
                    No shifts yet. Add one above.
                  </div>
                </td>
              </tr>
            )}
            {shifts.map((shift, i) => (
              <ShiftRow
                key={shift._id.toString()}
                id={shift._id.toString()}
                name={shift.name}
                startTime={shift.startTime}
                endTime={shift.endTime}
                lateGraceMinutes={shift.lateGraceMinutes}
                employeeCount={countById.get(shift._id.toString()) ?? 0}
                delay={i * 30}
              />
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-lg font-semibold">Rules for all shifts</h2>
      <SettingsForm settings={settings} />
    </main>
  );
}
