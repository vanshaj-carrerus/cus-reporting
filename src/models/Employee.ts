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
    // scrypt hash (see lib/password.ts). Never returned unless asked for with
    // .select("+passwordHash"). Unset until the employee sets their password.
    passwordHash: { type: String, select: false },
    passwordSetAt: { type: Date },
    // One-time code the admin hands to the employee so that only *they* can set
    // the password (see lib/setupCode.ts). Hashed, and cleared once used.
    setupCodeHash: { type: String, select: false },
    setupCodeExpiresAt: { type: Date, select: false },
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
