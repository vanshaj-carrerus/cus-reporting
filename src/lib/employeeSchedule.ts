import type { Types } from "mongoose";
import { BreakPlan } from "@/models/BreakPlan";
import { Shift } from "@/models/Shift";
import { ShiftSettings, SHIFT_SETTINGS_DEFAULTS } from "@/models/ShiftSettings";
import { OFFICE_LOCATION, OFFICE_RADIUS_METERS } from "./config";
import {
  resolveBreaks,
  resolveShiftInstance,
  type BreakInstance,
  type ShiftInstance,
  type ShiftTimes,
} from "./shifts";

export type ShiftSettingsValues = typeof SHIFT_SETTINGS_DEFAULTS;

/** The admin-tunable rules, with defaults filled in. Creates the document on first use. */
export async function getShiftSettings(): Promise<ShiftSettingsValues> {
  const doc = await ShiftSettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default", ...SHIFT_SETTINGS_DEFAULTS } },
    { upsert: true, new: true }
  ).lean();
  return {
    earlyCheckInMinutes: doc.earlyCheckInMinutes,
    noSignalMinutes: doc.noSignalMinutes,
    alarmIntervalMinutes: doc.alarmIntervalMinutes,
    ringsBeforeSilence: doc.ringsBeforeSilence,
  };
}

type EmployeeWithSchedule = {
  shift?: Types.ObjectId | null;
  breakPlan?: Types.ObjectId | null;
};

export interface LoadedShift extends ShiftTimes {
  id: string;
  name: string;
  lateGraceMinutes: number;
}

export interface LoadedPlan {
  id: string;
  name: string;
  breaks: { name: string; startTime: string; endTime: string }[];
}

/** The employee's assigned shift and break plan (each null if none assigned). */
export async function loadEmployeeSchedule(employee: EmployeeWithSchedule): Promise<{
  shift: LoadedShift | null;
  plan: LoadedPlan | null;
}> {
  const [shift, plan] = await Promise.all([
    employee.shift ? Shift.findById(employee.shift).lean() : null,
    employee.breakPlan ? BreakPlan.findById(employee.breakPlan).lean() : null,
  ]);
  return {
    shift: shift
      ? {
          id: shift._id.toString(),
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          lateGraceMinutes: shift.lateGraceMinutes,
        }
      : null,
    plan: plan
      ? {
          id: plan._id.toString(),
          name: plan.name,
          breaks: plan.breaks.map((b: { name: string; startTime: string; endTime: string }) => ({
            name: b.name,
            startTime: b.startTime,
            endTime: b.endTime,
          })),
        }
      : null,
  };
}

/** The shift instance to check in to right now (null = no shift, or it isn't open). */
export function checkInInstance(shift: LoadedShift, now: Date, settings: ShiftSettingsValues) {
  return resolveShiftInstance(shift, now, settings.earlyCheckInMinutes);
}

/** Concrete break windows for a shift instance. */
export function breaksFor(
  plan: LoadedPlan | null,
  shift: LoadedShift | null,
  instance: ShiftInstance | null
): BreakInstance[] {
  if (!plan || !shift || !instance) return [];
  return resolveBreaks(plan.breaks, shift, instance);
}

/**
 * What the app needs to run a shift: the shift, today's concrete break
 * windows, the office area to watch, and the alarm rules. `instance` is the
 * shift the employee is checked in to (or about to).
 */
export function scheduleForApp(
  shift: LoadedShift | null,
  plan: LoadedPlan | null,
  instance: ShiftInstance | null,
  settings: ShiftSettingsValues
) {
  return {
    shift: shift
      ? {
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          start: instance?.start.toISOString() ?? null,
          end: instance?.end.toISOString() ?? null,
        }
      : null,
    breaks: breaksFor(plan, shift, instance).map((b) => ({
      name: b.name,
      start: b.start.toISOString(),
      end: b.end.toISOString(),
    })),
    office: {
      latitude: OFFICE_LOCATION.latitude,
      longitude: OFFICE_LOCATION.longitude,
      radius: OFFICE_RADIUS_METERS,
    },
    alarm: {
      intervalMinutes: settings.alarmIntervalMinutes,
      ringsBeforeSilence: settings.ringsBeforeSilence,
    },
    noSignalMinutes: settings.noSignalMinutes,
  };
}

/** The shift instance an attendance record was checked in to (null for legacy records). */
export function instanceOfAttendance(attendance: {
  shiftDate?: string | null;
  shiftStart?: Date | null;
  shiftEnd?: Date | null;
}): ShiftInstance | null {
  if (!attendance.shiftDate || !attendance.shiftStart || !attendance.shiftEnd) return null;
  return {
    dateKey: attendance.shiftDate,
    start: attendance.shiftStart,
    end: attendance.shiftEnd,
  };
}
