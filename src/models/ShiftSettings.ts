import { Schema, model, models } from "mongoose";

// A single document of admin-tunable rules shared by every shift.
export const SHIFT_SETTINGS_DEFAULTS = {
  // How long before a shift starts an employee may already check in.
  earlyCheckInMinutes: 120,
  // No location report for this long during a shift = "No signal" (phone off / app closed).
  noSignalMinutes: 10,
  // The break-over alarm rings this often while the employee is still outside...
  alarmIntervalMinutes: 2,
  // ...and can only be silenced after this many rings.
  ringsBeforeSilence: 5,
};

const shiftSettingsSchema = new Schema({
  key: { type: String, required: true, unique: true, default: "default" },
  earlyCheckInMinutes: { type: Number, required: true, min: 0, max: 720 },
  noSignalMinutes: { type: Number, required: true, min: 2, max: 120 },
  alarmIntervalMinutes: { type: Number, required: true, min: 1, max: 30 },
  ringsBeforeSilence: { type: Number, required: true, min: 1, max: 20 },
});

export const ShiftSettings =
  models.ShiftSettings ?? model("ShiftSettings", shiftSettingsSchema);
