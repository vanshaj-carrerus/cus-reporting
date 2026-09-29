import { requireAdmin } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";
import AddEmployeeForm from "./AddEmployeeForm";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function AdminEmployeesPage() {
  await requireAdmin();
  await connectToDatabase();
  const employees = await Employee.find().sort({ name: 1 }).lean();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Employees</h1>
        <p className="text-sm text-muted">
          Only employees added here can appear on the check-in page.
        </p>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <AddEmployeeForm />
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
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {employees.length === 0 && (
              <tr>
                <td colSpan={1} className="px-4 py-10">
                  <div className="flex flex-col items-center gap-2 text-center text-muted">
                    <Users size={20} />
                    No employees yet. Add one above.
                  </div>
                </td>
              </tr>
            )}
            {employees.map((employee, i) => (
              <tr
                key={employee._id.toString()}
                className="animate-fade-in-up transition-smooth hover:bg-surface-2"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent-text">
                      {initials(employee.name)}
                    </div>
                    <span className="font-medium">{employee.name}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
