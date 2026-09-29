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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

employeeSchema.index({ name: 1 }, { unique: true, collation: NAME_COLLATION });

export type EmployeeDoc = InferSchemaType<typeof employeeSchema>;

export const Employee = models.Employee ?? model("Employee", employeeSchema);
