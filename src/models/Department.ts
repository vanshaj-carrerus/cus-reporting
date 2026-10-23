import { Schema, model, models, type InferSchemaType } from "mongoose";

export const DEPARTMENT_NAME_MAX_LENGTH = 60;

// Case-insensitive comparison, so "engineering" and "Engineering" are the same department.
export const DEPARTMENT_COLLATION = { locale: "en", strength: 2 } as const;

const departmentSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required."],
      trim: true,
      maxlength: [
        DEPARTMENT_NAME_MAX_LENGTH,
        `Department name must be at most ${DEPARTMENT_NAME_MAX_LENGTH} characters.`,
      ],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

departmentSchema.index({ name: 1 }, { unique: true, collation: DEPARTMENT_COLLATION });

export type DepartmentDoc = InferSchemaType<typeof departmentSchema>;

export const Department = models.Department ?? model("Department", departmentSchema);
