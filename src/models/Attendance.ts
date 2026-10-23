import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

export const ATTENDANCE_STATUSES = [
  "ON_TIME",
  "LATE",
  "OUT_OF_LOCATION",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

const attendanceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
  checkInTime: { type: Date, required: true, default: Date.now },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
  distanceFromOffice: { type: Number, required: true },
  // Set when the employee checks out (from the office, like check-in).
  checkOutTime: { type: Date },
  checkOutLatitude: { type: Number },
  checkOutLongitude: { type: Number },
  checkOutDistance: { type: Number },
  // The shift this attendance belongs to, frozen at check-in so later edits to
  // the shift never rewrite history. shiftDate is the IST date the shift STARTED
  // (a night shift checked in at 01:00 belongs to the previous date). Unset on
  // records from before shifts existed.
  shiftDate: { type: String },
  shiftName: { type: String },
  shiftStart: { type: Date },
  shiftEnd: { type: Date },
  // Live presence, updated by the app's location reports during the shift.
  lastSeenAt: { type: Date },
  lastSeenInside: { type: Boolean },
  // When the employee left the office area (cleared when they return).
  outsideSince: { type: Date },
  // Total minutes spent outside the office while NOT on a scheduled break.
  outsideMinutes: { type: Number, default: 0 },
  // Total minutes outside after a break window ended (a subset of outsideMinutes).
  breakOverrunMinutes: { type: Number, default: 0 },
});

attendanceSchema.index({ userId: 1, checkInTime: -1 });

export type AttendanceDoc = InferSchemaType<typeof attendanceSchema> & {
  _id: Types.ObjectId;
};

export const Attendance =
  models.Attendance ?? model("Attendance", attendanceSchema);
