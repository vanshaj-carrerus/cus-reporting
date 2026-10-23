import { requireAdmin } from "@/lib/adminAuth";
import { connectToDatabase } from "@/lib/mongodb";
import { BreakPlan, BREAK_PLAN_COLLATION } from "@/models/BreakPlan";
import { Employee } from "@/models/Employee";
import AddPlanForm from "./AddPlanForm";
import PlanCard from "./PlanCard";
import { Coffee } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminBreaksPage() {
  await requireAdmin();
  await connectToDatabase();

  const [plans, counts] = await Promise.all([
    BreakPlan.find().sort({ name: 1 }).collation(BREAK_PLAN_COLLATION).lean(),
    Employee.aggregate([{ $group: { _id: "$breakPlan", count: { $sum: 1 } } }]),
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count as number]));

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="animate-fade-in-up mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Breaks</h1>
        <p className="text-sm text-muted">
          A break plan is a set of fixed break times (IST). Employees can&apos;t start or end a
          break — it happens at these times. Assign a plan to each employee on the Employees tab,
          and make sure its breaks fall inside the employee&apos;s shift.
        </p>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "60ms" }}>
        <AddPlanForm />
      </div>

      <div className="space-y-3">
        {plans.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface px-4 py-10 text-center text-muted">
            <Coffee size={20} />
            No break plans yet. Add one above.
          </div>
        )}
        {plans.map((plan, i) => (
          <PlanCard
            key={plan._id.toString()}
            id={plan._id.toString()}
            name={plan.name}
            breaks={plan.breaks.map((b: { name: string; startTime: string; endTime: string }) => ({
              name: b.name,
              startTime: b.startTime,
              endTime: b.endTime,
            }))}
            employeeCount={countById.get(plan._id.toString()) ?? 0}
            delay={120 + i * 40}
          />
        ))}
      </div>
    </main>
  );
}
