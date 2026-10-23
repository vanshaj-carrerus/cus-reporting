import type { Types } from "mongoose";

type EmployeeLike = {
  _id: Types.ObjectId;
  name: string;
  email?: string | null;
  // Either the department id, or the department itself when populated.
  department?: Types.ObjectId | { _id: Types.ObjectId; name: string } | null;
  shift?: Types.ObjectId | { _id: Types.ObjectId; name: string; startTime: string; endTime: string } | null;
  breakPlan?: Types.ObjectId | { _id: Types.ObjectId; name: string } | null;
  passwordSetAt?: Date | null;
  createdAt?: Date;
};

/** What the admin sees of an employee — never any password or setup-code hash. */
export function employeeForAdmin(employee: EmployeeLike) {
  const department = employee.department;
  const populated = department && "name" in department ? department : null;
  const shift = employee.shift && "name" in employee.shift ? employee.shift : null;
  const plan = employee.breakPlan && "name" in employee.breakPlan ? employee.breakPlan : null;
  return {
    _id: employee._id.toString(),
    name: employee.name,
    email: employee.email ?? null,
    departmentId: department ? (populated?._id ?? department).toString() : null,
    departmentName: populated?.name ?? null,
    shiftId: employee.shift ? (shift?._id ?? employee.shift).toString() : null,
    shiftName: shift ? `${shift.name} (${shift.startTime}–${shift.endTime})` : null,
    breakPlanId: employee.breakPlan ? (plan?._id ?? employee.breakPlan).toString() : null,
    breakPlanName: plan?.name ?? null,
    passwordSetAt: employee.passwordSetAt ?? null,
    createdAt: employee.createdAt,
  };
}
