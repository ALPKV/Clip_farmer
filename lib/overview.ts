import "server-only";
import type { User } from "./auth";
import { goalCurrent, listDeliveries, listGoals, listInventory, listMatches, listPractice, serverToday } from "./data";
import { addDays, badges, currentStreak, pillarStatus, weekStart, weeklyLoads, type PracticeSession } from "./domain";

/** Weeks (Mon–Sun) in which all three pillars were logged. */
function optimalWeeks(sessions: PracticeSession[]): number {
  const weeks = new Set(sessions.filter((s) => s.status === "completed").map((s) => weekStart(s.date)));
  let n = 0;
  for (const w of weeks) if (pillarStatus(sessions, addDays(w, 6)).optimal) n++;
  return n;
}

/** Everything the Command Centre and the portfolio show. */
export async function loadOverview(user: User) {
  const [practice, matches, goals, inventory, deliveries, today] = await Promise.all([
    listPractice(user.id),
    listMatches(user.id),
    listGoals(user.id),
    listInventory(user.id),
    listDeliveries(user.id),
    serverToday(),
  ]);
  const inventoryRecent = inventory.some((i) => new Date(i.created_at).getTime() > Date.now() - 7 * 86_400_000);
  const status = pillarStatus(practice, today, inventoryRecent);
  const loads = weeklyLoads(practice, today, 8);
  const thisWeek = loads[loads.length - 1];
  const lastWeek = loads[loads.length - 2];
  const goalRows = goals.map((g) => ({ ...g, current: goalCurrent(g, practice, matches) }));
  const speeds = deliveries.map((d) => d.speed_kmh).filter((s): s is number => s != null);
  const overdue = practice.filter((s) => s.status === "planned" && s.date < today);
  return {
    today,
    practice,
    matches,
    inventory,
    deliveries,
    status,
    loads,
    thisWeek,
    lastWeek,
    risk: thisWeek.risk,
    goals: goalRows,
    streak: currentStreak(practice, today),
    badges: badges(practice, optimalWeeks(practice)),
    topSpeed: speeds.length ? Math.max(...speeds) : null,
    avgSpeed: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : null,
    upcoming: practice.filter((s) => s.status === "planned" && s.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    overdue,
  };
}
