// Run with: npx tsx scripts/test-shifts.ts
// Checks the IST shift/break maths, including night shifts that cross midnight.
import assert from "node:assert/strict";
import {
  breaksFitShift,
  classifyPresence,
  isLateForShift,
  resolveBreaks,
  resolveShiftInstance,
  shiftWindow,
  validateBreakPlan,
} from "../src/lib/shifts";

// IST is UTC+05:30, so a UTC instant is easiest to read as an IST wall time.
const ist = (isoWithoutZone: string) => new Date(`${isoWithoutZone}+05:30`);
const iso = (d: Date) => d.toISOString();

let passed = 0;
function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

const DAY = { startTime: "09:00", endTime: "18:00" };
const NIGHT = { startTime: "22:00", endTime: "06:00" };

test("day shift window is exact IST", () => {
  const w = shiftWindow(DAY, "2026-10-23");
  assert.equal(iso(w.start), "2026-10-23T03:30:00.000Z"); // 09:00 IST
  assert.equal(iso(w.end), "2026-10-23T12:30:00.000Z"); // 18:00 IST
});

test("night shift ends on the next calendar day", () => {
  const w = shiftWindow(NIGHT, "2026-10-23");
  assert.equal(iso(w.start), "2026-10-23T16:30:00.000Z"); // 22:00 IST 23rd
  assert.equal(iso(w.end), "2026-10-24T00:30:00.000Z"); // 06:00 IST 24th
});

test("equal start and end = 24h shift", () => {
  const w = shiftWindow({ startTime: "08:00", endTime: "08:00" }, "2026-10-23");
  assert.equal(w.end.getTime() - w.start.getTime(), 24 * 3600 * 1000);
});

test("day shift: closed before the early window, open inside it", () => {
  assert.equal(resolveShiftInstance(DAY, ist("2026-10-23T06:59:00"), 120), null);
  const i = resolveShiftInstance(DAY, ist("2026-10-23T07:00:00"), 120);
  assert.equal(i?.dateKey, "2026-10-23");
  assert.equal(resolveShiftInstance(DAY, ist("2026-10-23T18:00:00"), 120), null);
});

test("night shift: check-in at 23:30 and at 01:00 both belong to the date it started", () => {
  assert.equal(resolveShiftInstance(NIGHT, ist("2026-10-23T23:30:00"), 120)?.dateKey, "2026-10-23");
  assert.equal(resolveShiftInstance(NIGHT, ist("2026-10-24T01:00:00"), 120)?.dateKey, "2026-10-23");
});

test("night shift: early window opens at 20:00 and belongs to that evening", () => {
  assert.equal(resolveShiftInstance(NIGHT, ist("2026-10-23T19:59:00"), 120), null);
  assert.equal(resolveShiftInstance(NIGHT, ist("2026-10-23T20:00:00"), 120)?.dateKey, "2026-10-23");
});

test("night shift over at 06:00 IST", () => {
  assert.equal(resolveShiftInstance(NIGHT, ist("2026-10-24T05:59:00"), 0)?.dateKey, "2026-10-23");
  assert.equal(resolveShiftInstance(NIGHT, ist("2026-10-24T06:00:00"), 0), null);
});

test("date rollover across a month end (IST date, not UTC)", () => {
  // 00:30 IST on 1 Nov is still 31 Oct in UTC; the shift started 30 Oct IST.
  const i = resolveShiftInstance(NIGHT, ist("2026-11-01T00:30:00"), 0);
  assert.equal(i?.dateKey, "2026-10-31");
});

test("late / on-time boundary uses the grace period", () => {
  const i = shiftWindow(DAY, "2026-10-23");
  assert.equal(isLateForShift(i, 15, ist("2026-10-23T09:15:00")), false);
  assert.equal(isLateForShift(i, 15, ist("2026-10-23T09:15:01")), true);
  assert.equal(isLateForShift(i, 15, ist("2026-10-23T08:00:00")), false);
});

test("night shift late check works after midnight", () => {
  const i = shiftWindow(NIGHT, "2026-10-23");
  assert.equal(isLateForShift(i, 15, ist("2026-10-24T00:10:00")), true);
  assert.equal(isLateForShift(i, 15, ist("2026-10-23T22:10:00")), false);
});

test("breaks land on the right day for a night shift", () => {
  const instance = shiftWindow(NIGHT, "2026-10-23");
  const breaks = resolveBreaks(
    [
      { name: "Dinner", startTime: "00:30", endTime: "01:15" },
      { name: "Tea", startTime: "23:00", endTime: "23:10" },
    ],
    NIGHT,
    instance
  );
  assert.deepEqual(
    breaks.map((b) => [b.name, iso(b.start), iso(b.end)]),
    [
      ["Tea", "2026-10-23T17:30:00.000Z", "2026-10-23T17:40:00.000Z"], // 23:00 IST 23rd
      ["Dinner", "2026-10-23T19:00:00.000Z", "2026-10-23T19:45:00.000Z"], // 00:30 IST 24th
    ]
  );
});

test("a break crossing midnight is kept whole", () => {
  const instance = shiftWindow(NIGHT, "2026-10-23");
  const [b] = resolveBreaks([{ name: "Mid", startTime: "23:50", endTime: "00:10" }], NIGHT, instance);
  assert.equal(b.end.getTime() - b.start.getTime(), 20 * 60 * 1000);
  assert.equal(iso(b.start), "2026-10-23T18:20:00.000Z");
});

test("breaks outside the shift are dropped / reported", () => {
  const plan = [{ name: "Lunch", startTime: "13:00", endTime: "13:45" }];
  assert.equal(resolveBreaks(plan, NIGHT, shiftWindow(NIGHT, "2026-10-23")).length, 0);
  assert.match(breaksFitShift(plan, NIGHT) ?? "", /doesn't fall inside/);
  assert.equal(breaksFitShift(plan, DAY), null);
});

test("a break running past shift end doesn't fit", () => {
  const plan = [{ name: "Late", startTime: "17:45", endTime: "18:15" }];
  assert.notEqual(breaksFitShift(plan, DAY), null);
});

test("break plan validation: bad times, empty, overlap incl. midnight", () => {
  assert.match(validateBreakPlan([{ name: "A", startTime: "9:00", endTime: "10:00" }]) ?? "", /valid HH:mm/);
  assert.match(validateBreakPlan([{ name: "A", startTime: "10:00", endTime: "10:00" }]) ?? "", /same time/);
  assert.match(
    validateBreakPlan([
      { name: "A", startTime: "13:00", endTime: "14:00" },
      { name: "B", startTime: "13:30", endTime: "14:30" },
    ]) ?? "",
    /overlap/
  );
  assert.match(
    validateBreakPlan([
      { name: "A", startTime: "23:50", endTime: "00:20" },
      { name: "B", startTime: "00:10", endTime: "00:30" },
    ]) ?? "",
    /overlap/
  );
  assert.equal(
    validateBreakPlan([
      { name: "A", startTime: "13:00", endTime: "14:00" },
      { name: "B", startTime: "14:00", endTime: "14:10" }, // touching is fine
    ]),
    null
  );
});

const shift = shiftWindow(DAY, "2026-10-23");
const lunch = { start: ist("2026-10-23T13:30:00"), end: ist("2026-10-23T14:15:00") };
const base = {
  shift,
  breaks: [lunch],
  noSignalMinutes: 10,
  checkedOut: false,
};
const at = (t: string) => ist(`2026-10-23T${t}`);

test("presence: outside on a break is fine", () => {
  const r = classifyPresence({
    ...base, now: at("13:40:00"), inside: false, outsideSince: at("13:31:00"), lastSeenAt: at("13:39:30"),
  });
  assert.equal(r.state, "ON_BREAK");
});

test("presence: outside after the break ended = overrun", () => {
  const r = classifyPresence({
    ...base, now: at("14:20:00"), inside: false, outsideSince: at("13:31:00"), lastSeenAt: at("14:19:30"),
  });
  assert.equal(r.state, "BREAK_OVERRUN");
  assert.equal(iso(r.overrunSince as Date), iso(lunch.end));
});

test("presence: left after a break ended = plain outside, not overrun", () => {
  const r = classifyPresence({
    ...base, now: at("15:00:00"), inside: false, outsideSince: at("14:30:00"), lastSeenAt: at("14:59:30"),
  });
  assert.equal(r.state, "OUTSIDE");
});

test("presence: outside between breaks = outside", () => {
  const r = classifyPresence({
    ...base, now: at("11:00:00"), inside: false, outsideSince: at("10:50:00"), lastSeenAt: at("10:59:30"),
  });
  assert.equal(r.state, "OUTSIDE");
});

test("presence: silence = no signal, never 'inside'", () => {
  const r = classifyPresence({
    ...base, now: at("11:00:00"), inside: true, outsideSince: null, lastSeenAt: at("10:40:00"),
  });
  assert.equal(r.state, "NO_SIGNAL");
});

test("presence: outside the shift or after check-out is ignored", () => {
  const common = { ...base, inside: false, outsideSince: at("19:00:00"), lastSeenAt: at("19:59:30") };
  assert.equal(classifyPresence({ ...common, now: at("20:00:00") }).state, "NOT_IN_SHIFT");
  assert.equal(
    classifyPresence({ ...common, now: at("11:00:00"), checkedOut: true }).state,
    "NOT_IN_SHIFT"
  );
});

console.log(`\n${passed} passed`);
