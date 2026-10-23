import { requireAdmin } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { Department, DEPARTMENT_COLLATION } from "@/models/Department";
import { BreakPlan, BREAK_PLAN_COLLATION } from "@/models/BreakPlan";
import { Employee } from "@/models/Employee";
import { Shift } from "@/models/Shift";
import AddDepartmentForm from "./AddDepartmentForm";
import DepartmentRow from "./DepartmentRow";
import { Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDepartmentsPage() {
  await requireAdmin();
  await connectToDatabase();

  const [departments, counts, shifts, plans] = await Promise.all([
    Department.find().sort({ name: 1 }).collation(DEPARTMENT_COLLATION).lean(),
    Employee.aggregate([{ $group: { _id: "$department", count: { $sum: 1 } } }]),
    Shift.find().sort({ startTime: 1, name: 1 }).lean(),
    BreakPlan.find().sort({ name: 1 }).collation(BREAK_PLAN_COLLATION).lean(),
  ]);
  const shiftOptions = shifts.map((s) => ({
    id: s._id.toString(),
    name: `${s.name} (${s.startTime}–${s.endTime})`,
  }));
  const planOptions = plans.map((p) => ({ id: p._id.toString(), name: p.name }));
  const countById = new Map(counts.map((c) => [String(c._id), c.count as number]));
  const unassigned = countById.get("null") ?? countById.get("undefined") ?? 0;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Departments</h1>
        <p className="text-sm text-muted">
          Create departments here, then assign each employee to one on the Employees tab. The
          attendance dashboard can be filtered by department.
        </p>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <AddDepartmentForm />
      </div>

      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        style={{ animationDelay: "120ms" }}
      >
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-2/60">
            <tr>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Department
              </th>
              <th className="px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {departments.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center text-muted">
                    <Building2 size={20} />
                    No departments yet. Add one above.
                  </div>
                </td>
              </tr>
            )}
            {departments.map((department, i) => (
              <DepartmentRow
                key={department._id.toString()}
                id={department._id.toString()}
                name={department.name}
                employeeCount={countById.get(department._id.toString()) ?? 0}
                delay={i * 30}
                shifts={shiftOptions}
                breakPlans={planOptions}
              />
            ))}
          </tbody>
        </table>
      </div>
      {unassigned > 0 && (
        <p className="mt-3 text-xs text-muted">
          {unassigned} {unassigned === 1 ? "employee has" : "employees have"} no department yet —
          assign them on the Employees tab.
        </p>
      )}
    </main>
  );
}
