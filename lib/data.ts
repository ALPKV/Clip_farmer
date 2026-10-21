import "server-only";
import { cookies } from "next/headers";
import { query } from "./db";
import type { PracticeSession } from "./domain";

/** Today's date in the viewer's time zone (set by the browser in the flipper_tz cookie). */
export async function serverToday(): Promise<string> {
  const tz = (await cookies()).get("flipper_tz")?.value;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const D = (col: string) => `to_char(${col}, 'YYYY-MM-DD') as ${col}`;

export async function listPractice(userId: string): Promise<PracticeSession[]> {
  return query<PracticeSession>(
    `select id, ${D("date")}, category, title, status, planned_minutes, duration_min, rpe,
            intent, reflection, details, completed_at, logged_at
       from practice_sessions where user_id = $1 order by date desc, created_at desc`,
    [userId],
  );
}

export type MatchLog = {
  id: string;
  date: string;
  opponent: string;
  format: string;
  batted: boolean;
  runs: number;
  balls_faced: number;
  not_out: boolean;
  dismissal: string;
  dismissal_error: string;
  balls_bowled: number;
  runs_conceded: number;
  wickets: number;
  notes: string;
};

export async function listMatches(userId: string): Promise<MatchLog[]> {
  return query<MatchLog>(
    `select id, ${D("date")}, opponent, format, batted, runs, balls_faced, not_out, dismissal,
            dismissal_error, balls_bowled, runs_conceded, wickets, notes
       from match_logs where user_id = $1 order by date desc, created_at desc`,
    [userId],
  );
}

export type InventoryItem = { id: string; kind: "strength" | "weakness"; pillar: string; text: string; created_at: string };

export async function listInventory(userId: string): Promise<InventoryItem[]> {
  return query<InventoryItem>(
    "select id, kind, pillar, text, created_at from inventory_items where user_id = $1 order by created_at desc",
    [userId],
  );
}

export type Goal = {
  id: string;
  title: string;
  metric: string;
  unit: string;
  target: number;
  baseline: number;
  manual_current: number | null;
  season_start: string;
  season_end: string;
};

export async function listGoals(userId: string): Promise<Goal[]> {
  return query<Goal>(
    `select id, title, metric, unit, target, baseline, manual_current, ${D("season_start")}, ${D("season_end")}
       from goals where user_id = $1 order by created_at`,
    [userId],
  );
}

export type CarbLog = { id: string; date: string; meal: string; carbs_g: number; timing: string };

export async function listCarbs(userId: string, from: string): Promise<CarbLog[]> {
  return query<CarbLog>(
    `select id, ${D("date")}, meal, carbs_g, timing from carb_logs
      where user_id = $1 and date >= $2 order by date desc, created_at desc`,
    [userId, from],
  );
}

export type Delivery = {
  id: string;
  date: string;
  speed_kmh: number | null;
  length_m: number | null;
  line_cm: number | null;
  video_name: string;
  method: string;
};

export async function listDeliveries(userId: string): Promise<Delivery[]> {
  return query<Delivery>(
    `select id, ${D("date")}, speed_kmh, length_m, line_cm, video_name, method
       from deliveries where user_id = $1 order by date desc, created_at desc limit 500`,
    [userId],
  );
}

/** Current value for a goal: derived from logs for known metrics, otherwise the manual value. */
export function goalCurrent(
  goal: Goal,
  practice: PracticeSession[],
  matches: MatchLog[],
): number {
  const inSeason = (d: string) => d >= goal.season_start && d <= goal.season_end;
  const m = matches.filter((x) => inSeason(x.date));
  const p = practice.filter((x) => x.status === "completed" && inSeason(x.date));
  switch (goal.metric) {
    case "runs":
      return goal.baseline + m.reduce((a, x) => a + x.runs, 0);
    case "wickets":
      return goal.baseline + m.reduce((a, x) => a + x.wickets, 0);
    case "practice_hours":
      return goal.baseline + p.reduce((a, x) => a + (x.duration_min ?? 0), 0) / 60;
    case "sessions":
      return goal.baseline + p.length;
    default:
      return goal.manual_current ?? goal.baseline;
  }
}
