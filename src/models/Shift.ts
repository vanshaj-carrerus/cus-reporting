import { Schema, model, models, type InferSchemaType } from "mongoose";

export const SHIFT_NAME_MAX_LENGTH = 60;
export const DEFAULT_LATE_GRACE_MINUTES = 15;

// Case-insensitive comparison, so "night" and "Night" are the same shift.
export const SHIFT_COLLATION = { locale: "en", strength: 2 } as const;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const shiftSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Shift name is required."],
      trim: true,
      maxlength: [
        SHIFT_NAME_MAX_LENGTH,
        `Shift name must be at most ${SHIFT_NAME_MAX_LENGTH} characters.`,
      ],
    },
    // Indian Standard Time, 24h "HH:mm". If endTime <= startTime the shift runs
    // past midnight into the next day (a night shift); equal times mean 24 hours.
    startTime: { type: String, required: true, match: HHMM },
    endTime: { type: String, required: true, match: HHMM },
    // Minutes after startTime during which a check-in is still "On time".
    lateGraceMinutes: {
      type: Number,
      required: true,
      default: DEFAULT_LATE_GRACE_MINUTES,
      min: 0,
      max: 240,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

shiftSchema.index({ name: 1 }, { unique: true, collation: SHIFT_COLLATION });

export type ShiftDoc = InferSchemaType<typeof shiftSchema>;

export const Shift = models.Shift ?? model("Shift", shiftSchema);
