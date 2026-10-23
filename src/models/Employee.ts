import { Schema, model, models, type InferSchemaType } from "mongoose";

export const EMPLOYEE_NAME_MAX_LENGTH = 80;

// Case-insensitive comparison, so "asha rao" and "Asha Rao" count as the same name.
export const NAME_COLLATION = { locale: "en", strength: 2 } as const;

const employeeSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      maxlength: [
        EMPLOYEE_NAME_MAX_LENGTH,
        `Name must be at most ${EMPLOYEE_NAME_MAX_LENGTH} characters.`,
      ],
    },
    // The employee's login. Always stored normalized (see lib/email.ts). Optional
    // only because employees created before accounts existed have none yet.
    email: { type: String, trim: true, lowercase: true },
    // The employee's department. Optional: employees created before departments
    // existed (or whose department was deleted) are simply "Unassigned".
    department: { type: Schema.Types.ObjectId, ref: "Department" },
    // Working hours (day/night, IST) and the fixed break windows within them.
    // Both optional: with no shift the old single late-cutoff rule still applies.
    shift: { type: Schema.Types.ObjectId, ref: "Shift" },
    breakPlan: { type: Schema.Types.ObjectId, ref: "BreakPlan" },
    // scrypt hash (see lib/password.ts). Never returned unless asked for with
    // .select("+passwordHash"). Unset until the employee sets their password.
    passwordHash: { type: String, select: false },
    passwordSetAt: { type: Date },
    // Emailed verification code for setting/resetting the password (see
    // lib/verificationCode.ts). Hashed, short-lived, and cleared once used.
    verifyCodeHash: { type: String, select: false },
    verifyCodeExpiresAt: { type: Date, select: false },
    verifyCodeSentAt: { type: Date, select: false },
    verifyCodeAttempts: { type: Number, select: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

employeeSchema.index({ name: 1 }, { unique: true, collation: NAME_COLLATION });
// Partial, so the employees that have no email yet don't collide with each other.
employeeSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);

export type EmployeeDoc = InferSchemaType<typeof employeeSchema>;

export const Employee = models.Employee ?? model("Employee", employeeSchema);
