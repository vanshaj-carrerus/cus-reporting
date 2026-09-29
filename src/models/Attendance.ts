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
});

attendanceSchema.index({ userId: 1, checkInTime: -1 });

export type AttendanceDoc = InferSchemaType<typeof attendanceSchema> & {
  _id: Types.ObjectId;
};

export const Attendance =
  models.Attendance ?? model("Attendance", attendanceSchema);
