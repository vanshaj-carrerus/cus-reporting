import { Schema, model, models, type InferSchemaType } from "mongoose";

export const BREAK_PLAN_NAME_MAX_LENGTH = 60;
export const BREAK_NAME_MAX_LENGTH = 40;

export const BREAK_PLAN_COLLATION = { locale: "en", strength: 2 } as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// One fixed break window, in IST "HH:mm". A window may cross midnight (e.g.
// 23:50-00:10 on a night shift). Employees can't start or end it — it simply
// happens at these times.
const breakSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: BREAK_NAME_MAX_LENGTH },
    startTime: { type: String, required: true, match: HHMM },
    endTime: { type: String, required: true, match: HHMM },
  },
  { _id: false }
);

const breakPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Break plan name is required."],
      trim: true,
      maxlength: BREAK_PLAN_NAME_MAX_LENGTH,
    },
    breaks: { type: [breakSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

breakPlanSchema.index({ name: 1 }, { unique: true, collation: BREAK_PLAN_COLLATION });

export type BreakPlanDoc = InferSchemaType<typeof breakPlanSchema>;

export const BreakPlan = models.BreakPlan ?? model("BreakPlan", breakPlanSchema);
