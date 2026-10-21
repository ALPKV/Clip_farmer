import assert from "node:assert/strict";
import { test } from "node:test";
import { badges, currentStreak, dayType, logWindowError, pillarStatus, weekStart, weeklyLoads, type PracticeSession } from "../lib/domain.ts";

const s = (date: string, over: Partial<PracticeSession> = {}): PracticeSession => ({
  id: date + Math.random(),
  date,
  category: "open_nets",
  title: "",
  status: "completed",
  planned_minutes: null,
  duration_min: 60,
  rpe: 5,
  intent: "stay side-on",
  reflection: "",
  details: {},
  completed_at: null,
  logged_at: null,
  ...over,
});

test("weeks start on Monday", () => {
  assert.equal(weekStart("2026-10-21"), "2026-10-19"); // Wednesday → Monday
  assert.equal(weekStart("2026-10-19"), "2026-10-19");
  assert.equal(weekStart("2026-10-25"), "2026-10-19"); // Sunday
});

test("flags high injury risk when load rises more than 20% week over week", () => {
  const sessions = [s("2026-10-13", { duration_min: 100, rpe: 5 }), s("2026-10-20", { duration_min: 100, rpe: 7 })];
  const loads = weeklyLoads(sessions, "2026-10-21", 2);
  assert.deepEqual(loads.map((l) => l.load), [500, 700]);
  assert.equal(loads[1].risk, true);
  const steady = weeklyLoads([s("2026-10-13"), s("2026-10-20", { rpe: 6 })], "2026-10-21", 2);
  assert.equal(steady[1].risk, false); // +20% exactly is not a spike
});

test("enforces logging within 2 hours", () => {
  const now = new Date("2026-10-21T12:00:00Z");
  assert.equal(logWindowError(new Date("2026-10-21T10:30:00Z"), now), null);
  assert.match(logWindowError(new Date("2026-10-21T09:30:00Z"), now) ?? "", /within 2 hours/);
  assert.match(logWindowError(new Date("2026-10-21T13:00:00Z"), now) ?? "", /future/);
});

test("optimal status needs physical, technical and mental work in 7 days", () => {
  const today = "2026-10-21";
  const base = [s("2026-10-20"), s("2026-10-19", { category: "conditioning" })];
  assert.equal(pillarStatus(base, today).optimal, false);
  const withReflection = [...base, s("2026-10-21", { reflection: "kept my head still" })];
  assert.equal(pillarStatus(withReflection, today).optimal, true);
  assert.equal(pillarStatus([...base.map((x) => ({ ...x, date: "2026-10-01" }))], today).met.physical, false);
});

test("streaks and badges", () => {
  const sessions = ["2026-10-18", "2026-10-19", "2026-10-20"].map((d) => s(d));
  assert.equal(currentStreak(sessions, "2026-10-21"), 3); // counts up to yesterday
  assert.equal(currentStreak(sessions, "2026-10-23"), 0);
  const b = badges(sessions, 0);
  assert.equal(b.find((x) => x.id === "streak3")?.earned, true);
  assert.equal(b.find((x) => x.id === "streak7")?.earned, false);
});

test("day type for carbohydrate targets", () => {
  assert.equal(dayType([], true), "heavy");
  assert.equal(dayType([], false), "rest");
  assert.equal(dayType([s("x", { duration_min: 60 })], false), "training");
  assert.equal(dayType([s("x", { duration_min: 150 })], false), "heavy");
});
