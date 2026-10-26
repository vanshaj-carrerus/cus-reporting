import { requireAdmin } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { Department, DEPARTMENT_COLLATION } from "@/models/Department";
import { BreakPlan, BREAK_PLAN_COLLATION } from "@/models/BreakPlan";
import { getRelease, isOutdated } from "@/lib/appVersion";
import { agoText, inactiveCutoff, lastActivity } from "@/lib/inactivity";
import { Employee } from "@/models/Employee";
import { Shift } from "@/models/Shift";
import AddEmployeeForm from "./AddEmployeeForm";
import EmployeeRow from "./EmployeeRow";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminEmployeesPage() {
  await requireAdmin();
  await connectToDatabase();
  const [employees, departments, shifts, plans] = await Promise.all([
    Employee.find().sort({ name: 1 }).lean(),
    Department.find().sort({ name: 1 }).collation(DEPARTMENT_COLLATION).lean(),
    Shift.find().sort({ startTime: 1, name: 1 }).lean(),
    BreakPlan.find().sort({ name: 1 }).collation(BREAK_PLAN_COLLATION).lean(),
  ]);
  const departmentOptions = departments.map((d) => ({
    id: d._id.toString(),
    name: d.name,
  }));
  const shiftOptions = shifts.map((s) => ({
    id: s._id.toString(),
    name: `${s.name} (${s.startTime}–${s.endTime})`,
  }));
  const planOptions = plans.map((p) => ({ id: p._id.toString(), name: p.name }));

  const release = await getRelease();
  const cutoff = inactiveCutoff();
  const activity = (e: {
    lastActiveAt?: Date | null;
    passwordSetAt?: Date | null;
    createdAt?: Date | null;
  }) => {
    const last = lastActivity(e);
    return {
      activityLabel: last ? `Last active ${agoText(last)}` : "Never signed in",
      inactive: (last ?? e.createdAt ?? new Date()) < cutoff,
    };
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Employees</h1>
        <p className="text-sm text-muted">
          Each employee signs in to the app with their own email and password. They set or reset it themselves: the app emails a verification code to the address you register here.
        </p>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <AddEmployeeForm
          departments={departmentOptions}
          shifts={shiftOptions}
          breakPlans={planOptions}
        />
      </div>

      <div
        className="animate-fade-in-up overflow-hidden rounded-xl border border-border bg-surface shadow-sm"
        style={{ animationDelay: "120ms" }}
      >
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-surface-2/60">
            <tr>
              <th className="px-4 py-3 text-left font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Name
              </th>
              <th className="px-4 py-3 text-right font-mono text-[11px] font-medium uppercase tracking-wider text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {employees.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center text-muted">
                    <Users size={20} />
                    No employees yet. Add one above.
                  </div>
                </td>
              </tr>
            )}
            {employees.map((employee, i) => (
              <EmployeeRow
                key={employee._id.toString()}
                id={employee._id.toString()}
                name={employee.name}
                email={employee.email ?? null}
                departmentId={employee.department?.toString() ?? null}
                departments={departmentOptions}
                shiftId={employee.shift?.toString() ?? null}
                shifts={shiftOptions}
                breakPlanId={employee.breakPlan?.toString() ?? null}
                breakPlans={planOptions}
                passwordSet={Boolean(employee.passwordSetAt)}
                {...activity(employee)}
                appVersion={employee.appVersion ?? null}
                appOutdated={Boolean(employee.passwordSetAt) && isOutdated(release, employee.appVersion)}
                delay={i * 30}
              />
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
