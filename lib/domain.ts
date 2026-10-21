/**
 * WillowFlow PRD rules, shared by the server and the browser. Pure functions only.
 */

export const CATEGORIES = {
  open_nets: { label: "Open nets", pillar: "technical", group: "Net sessions" },
  scenario_nets: { label: "Scenario nets", pillar: "technical", group: "Net sessions" },
  technical_drill: { label: "Technical drill", pillar: "technical", group: "Technical" },
  bowling_machine: { label: "Bowling machine", pillar: "technical", group: "Technical" },
  spot_bowling: { label: "Spot bowling", pillar: "technical", group: "Technical" },
  skill_development: { label: "New skill", pillar: "technical", group: "Skill development" },
  conditioning: { label: "Conditioning", pillar: "physical", group: "Physical" },
} as const;

export type Category = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

export const CONDITIONING_TYPES = ["Sprints", "Gym", "Mobility", "Endurance"] as const;

export type PracticeSession = {
  id: string;
  date: string; // YYYY-MM-DD
  category: Category;
  title: string;
  status: "planned" | "completed";
  planned_minutes: number | null;
  duration_min: number | null;
  rpe: number | null;
  intent: string;
  reflection: string;
  details: Record<string, unknown>;
  completed_at: string | null;
  logged_at: string | null;
};

/** PRD 4: practice must be logged within 2 hours of completion. */
export const LOG_WINDOW_MS = 2 * 60 * 60 * 1000;

export function logWindowError(completedAt: Date, now = new Date()): string | null {
  const age = now.getTime() - completedAt.getTime();
  if (age < -5 * 60 * 1000) return "The finish time is in the future.";
  if (age > LOG_WINDOW_MS) {
    return "Sessions must be logged within 2 hours of finishing, while the reflection is still accurate.";
  }
  return null;
}

/** Session load in arbitrary units: minutes × RPE (session-RPE method). */
export const sessionLoad = (s: Pick<PracticeSession, "duration_min" | "rpe">) =>
  (s.duration_min ?? 0) * (s.rpe ?? 0);

/** Monday of the week containing `date` (YYYY-MM-DD), as YYYY-MM-DD. */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type WeekLoad = { week: string; load: number; minutes: number; sessions: number; spike: number | null; risk: boolean };

/**
 * Weekly loads for the `weeks` weeks ending with the week of `today`.
 * PRD 4: "High Injury Risk" when load rises more than 20% week over week.
 */
export function weeklyLoads(sessions: PracticeSession[], today: string, weeks = 8): WeekLoad[] {
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  const out: WeekLoad[] = [];
  for (let i = 0; i < weeks; i++) {
    out.push({ week: addDays(first, 7 * i), load: 0, minutes: 0, sessions: 0, spike: null, risk: false });
  }
  for (const s of sessions) {
    if (s.status !== "completed") continue;
    const idx = Math.round((Date.parse(weekStart(s.date)) - Date.parse(first)) / (7 * 86_400_000));
    if (idx < 0 || idx >= weeks) continue;
    out[idx].load += sessionLoad(s);
    out[idx].minutes += s.duration_min ?? 0;
    out[idx].sessions += 1;
  }
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1].load;
    if (prev > 0) {
      const spike = (out[i].load - prev) / prev;
      out[i].spike = spike;
      out[i].risk = spike > 0.2;
    }
  }
  return out;
}

export type Pillar = "physical" | "technical" | "mental";

/**
 * PRD 4 "Holistic approach": Optimal status needs physical, technical and mental work
 * logged in the last 7 days. Mental counts a completed session with both an intent and a reflection.
 */
export function pillarStatus(sessions: PracticeSession[], today: string, inventoryUpdated = false) {
  const from = addDays(today, -6);
  const recent = sessions.filter((s) => s.status === "completed" && s.date >= from && s.date <= today);
  const physical = recent.some((s) => CATEGORIES[s.category].pillar === "physical");
  const technical = recent.some((s) => CATEGORIES[s.category].pillar === "technical");
  const mental = inventoryUpdated || recent.some((s) => s.intent.trim() && s.reflection.trim());
  const met: Record<Pillar, boolean> = { physical, technical, mental };
  return { met, optimal: physical && technical && mental };
}

export type Badge = { id: string; title: string; detail: string; earned: boolean; progress: number };

/** Consecutive days, ending today or yesterday, with at least one completed session. */
export function currentStreak(sessions: PracticeSession[], today: string): number {
  const days = new Set(sessions.filter((s) => s.status === "completed").map((s) => s.date));
  let day = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function longestStreak(sessions: PracticeSession[]): number {
  const days = [...new Set(sessions.filter((s) => s.status === "completed").map((s) => s.date))].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && addDays(days[i - 1], 1) === days[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

export function badges(sessions: PracticeSession[], optimalWeeks: number): Badge[] {
  const done = sessions.filter((s) => s.status === "completed");
  const streak = longestStreak(sessions);
  const reflections = done.filter((s) => s.reflection.trim()).length;
  const scenario = done.filter((s) => s.category === "scenario_nets").length;
  const skill = done.filter((s) => s.category === "skill_development").length;
  const b = (id: string, title: string, detail: string, value: number, goal: number): Badge => ({
    id,
    title,
    detail,
    earned: value >= goal,
    progress: Math.min(1, value / goal),
  });
  return [
    b("first", "First Ball", "Log your first session", done.length, 1),
    b("streak3", "Three in a Row", "3-day practice streak", streak, 3),
    b("streak7", "Full Week", "7-day practice streak", streak, 7),
    b("sessions25", "Quarter Century", "25 sessions completed", done.length, 25),
    b("sessions100", "Centurion", "100 sessions completed", done.length, 100),
    b("reflect10", "Student of the Game", "10 post-session reflections", reflections, 10),
    b("scenario5", "Pressure Tested", "5 scenario net sessions", scenario, 5),
    b("skill5", "New Weapon", "5 sessions on a new skill", skill, 5),
    b("optimal", "Complete Cricketer", "Reach Optimal status in a week", optimalWeeks, 1),
  ];
}

/**
 * Daily carbohydrate guidance in g per kg body mass, from sports-nutrition consensus ranges
 * (ACSM/AND/DC 2016 position stand). General guidance only.
 */
export const CARB_RANGES = {
  rest: { label: "Rest / light day", min: 3, max: 5 },
  training: { label: "Training day", min: 5, max: 7 },
  heavy: { label: "Match or heavy training", min: 6, max: 10 },
} as const;
export type DayType = keyof typeof CARB_RANGES;

export function dayType(sessionsOnDay: PracticeSession[], matchOnDay: boolean): DayType {
  if (matchOnDay) return "heavy";
  const minutes = sessionsOnDay.reduce((m, s) => m + (s.duration_min ?? s.planned_minutes ?? 0), 0);
  const load = sessionsOnDay.reduce((l, s) => l + sessionLoad(s), 0);
  if (minutes >= 120 || load >= 700) return "heavy";
  if (minutes > 0) return "training";
  return "rest";
}

/** Length zones in metres from the batter's stumps. */
export const LENGTH_ZONES = [
  { label: "Yorker", from: 0, to: 2 },
  { label: "Full", from: 2, to: 6 },
  { label: "Good", from: 6, to: 8 },
  { label: "Back of length", from: 8, to: 10 },
  { label: "Short", from: 10, to: 20.12 },
] as const;

export const lengthZone = (m: number) => LENGTH_ZONES.find((z) => m >= z.from && m < z.to)?.label ?? "Short";

export const strikeRate = (runs: number, balls: number) => (balls > 0 ? (runs / balls) * 100 : null);
export const economy = (runs: number, balls: number) => (balls > 0 ? runs / (balls / 6) : null);
export const oversText = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

export function todayLocal(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
