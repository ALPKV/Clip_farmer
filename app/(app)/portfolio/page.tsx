import type { Metadata } from "next";
import { PrintButton } from "@/components/print-button";
import { Container, PageHeader, Panel, Stat, fmt } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CATEGORIES, CATEGORY_KEYS, economy, longestStreak, strikeRate } from "@/lib/domain";
import { loadOverview } from "@/lib/overview";

export const metadata: Metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const user = await requireUser();
  const o = await loadOverview(user);
  const done = o.practice.filter((s) => s.status === "completed");
  const hours = done.reduce((a, s) => a + (s.duration_min ?? 0), 0) / 60;
  const innings = o.matches.filter((m) => m.batted);
  const runs = innings.reduce((a, m) => a + m.runs, 0);
  const balls = innings.reduce((a, m) => a + m.balls_faced, 0);
  const outs = innings.filter((m) => !m.not_out).length;
  const ballsBowled = o.matches.reduce((a, m) => a + m.balls_bowled, 0);
  const wickets = o.matches.reduce((a, m) => a + m.wickets, 0);
  const conceded = o.matches.reduce((a, m) => a + m.runs_conceded, 0);
  const reflected = done.filter((s) => s.reflection.trim()).length;
  const first = done.length ? done[done.length - 1].date : null;

  return (
    <>
      <PageHeader eyebrow="Digital performance portfolio" title={user.name} aside={<PrintButton />}>
        {user.role.replace("-", " ")} · {done.length} logged sessions{first ? ` since ${fmt.date(first)}` : ""}. Evidence of structure,
        discipline and a long-term approach, for coaches, academies and scouts.
      </PageHeader>
      <Container className="space-y-6 print:space-y-4">
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Practice hours" value={hours.toFixed(1)} note={`${done.length} sessions`} />
          <Stat label="Longest streak" value={longestStreak(o.practice)} unit="days" />
          <Stat label="Reflections" value={done.length ? `${Math.round((reflected / done.length) * 100)}%` : "—"} note="Sessions with a written reflection" />
          <Stat label="Badges" value={o.badges.filter((b) => b.earned).length} note={`of ${o.badges.length}`} />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Panel title="Match record">
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-slate">Innings</dt><dd className="text-right font-semibold">{innings.length}</dd>
              <dt className="text-slate">Runs</dt><dd className="text-right font-semibold">{runs}</dd>
              <dt className="text-slate">Average</dt><dd className="text-right font-semibold">{outs ? (runs / outs).toFixed(1) : "—"}</dd>
              <dt className="text-slate">Strike rate</dt><dd className="text-right font-semibold">{fmt.num(strikeRate(runs, balls), 1)}</dd>
              <dt className="text-slate">Wickets</dt><dd className="text-right font-semibold">{wickets}</dd>
              <dt className="text-slate">Economy</dt><dd className="text-right font-semibold">{fmt.num(economy(conceded, ballsBowled), 2)}</dd>
              <dt className="text-slate">Top tracked speed</dt><dd className="text-right font-semibold">{o.topSpeed ? `${o.topSpeed.toFixed(0)} km/h` : "—"}</dd>
            </dl>
          </Panel>
          <Panel title="Where the hours go">
            <ul className="space-y-2 text-sm">
              {CATEGORY_KEYS.map((k) => {
                const min = done.filter((s) => s.category === k).reduce((a, s) => a + (s.duration_min ?? 0), 0);
                return (
                  <li key={k} className="flex items-center gap-3">
                    <span className="w-36">{CATEGORIES[k].label}</span>
                    <span className="h-2 flex-1 bg-paper"><span className="block h-full bg-navy" style={{ width: `${hours ? (min / 60 / hours) * 100 : 0}%` }} /></span>
                    <span className="w-14 text-right tabular-nums">{(min / 60).toFixed(1)} h</span>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="Season goals">
            {o.goals.length === 0 ? <p className="text-sm text-slate">No goals set.</p> : (
              <ul className="space-y-2 text-sm">
                {o.goals.map((g) => (
                  <li key={g.id} className="flex justify-between gap-3"><span>{g.title}</span><span className="font-semibold tabular-nums">{fmt.num(g.current, 0)} / {g.target} {g.unit}</span></li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Self-assessment">
            <p className="eyebrow text-ok">Strengths</p>
            <ul className="mb-3 mt-1 list-disc pl-5 text-sm">{o.inventory.filter((i) => i.kind === "strength").map((i) => <li key={i.id}>{i.text}</li>)}</ul>
            <p className="eyebrow text-risk">Working on</p>
            <ul className="mt-1 list-disc pl-5 text-sm">{o.inventory.filter((i) => i.kind === "weakness").map((i) => <li key={i.id}>{i.text}</li>)}</ul>
          </Panel>
        </div>
      </Container>
    </>
  );
}
