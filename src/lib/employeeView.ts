import type { Types } from "mongoose";

type EmployeeLike = {
  _id: Types.ObjectId;
  name: string;
  email?: string | null;
  passwordSetAt?: Date | null;
  createdAt?: Date;
};

/** What the admin sees of an employee — never any password or setup-code hash. */
export function employeeForAdmin(employee: EmployeeLike) {
  return {
    _id: employee._id.toString(),
    name: employee.name,
    email: employee.email ?? null,
    passwordSetAt: employee.passwordSetAt ?? null,
    createdAt: employee.createdAt,
  };
}
