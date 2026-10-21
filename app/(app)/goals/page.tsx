import type { Metadata } from "next";
import { DeleteButton, GoalForm, GoalProgressInput } from "@/components/forms";
import { Container, Empty, Meter, PageHeader, Panel, Tag, fmt } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/domain";
import { loadOverview } from "@/lib/overview";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const user = await requireUser();
  const o = await loadOverview(user);
  const seasonStart = user.season_start ?? o.today;
  const seasonEnd = user.season_end ?? addDays(o.today, 180);

  return (
    <>
      <PageHeader eyebrow="Professional milestones" title="Goals">
        Season targets that update from your logs, and badges for showing up consistently.
      </PageHeader>
      <Container className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Panel title="Season targets">
            {o.goals.length === 0 ? (
              <Empty title="No goals yet">Set a few measurable targets for the season, such as runs, wickets or practice hours.</Empty>
            ) : (
              <ul className="space-y-6">
                {o.goals.map((g) => {
                  const pct = Math.min(100, (g.current / g.target) * 100);
                  const totalDays = Math.max(1, (Date.parse(g.season_end) - Date.parse(g.season_start)) / 86_400_000);
                  const elapsed = Math.min(1, Math.max(0, (Date.parse(o.today) - Date.parse(g.season_start)) / 86_400_000 / totalDays));
                  const expected = g.baseline + (g.target - g.baseline) * elapsed;
                  const onTrack = g.current >= expected;
                  return (
                    <li key={g.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-xl font-bold uppercase text-navy">{g.title}</p>
                          <p className="text-xs text-slate">{fmt.date(g.season_start)} – {fmt.date(g.season_end)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {g.current >= g.target ? <Tag tone="gold">Achieved</Tag> : <Tag tone={onTrack ? "ok" : "mute"}>{onTrack ? "On track" : "Behind pace"}</Tag>}
                          <DeleteButton url={`/api/goals/${g.id}`} label="Delete goal" />
                        </div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="display text-3xl font-extrabold text-navy">{fmt.num(g.current, g.metric === "practice_hours" ? 1 : 0)}</span>
                        <span className="text-sm text-slate">/ {g.target} {g.unit} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="relative mt-2">
                        <Meter value={g.current} max={g.target} tone={g.current >= g.target ? "gold" : "navy"} />
                        <span
                          className="absolute -top-1 h-4 w-0.5 bg-gold"
                          style={{ left: `${Math.min(100, (expected / g.target) * 100)}%` }}
                          title="Where you should be by now"
                        />
                      </div>
                      {g.metric === "custom" ? <GoalProgressInput id={g.id} current={g.current} /> : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {o.goals.length > 0 ? <p className="mt-4 text-xs text-mute">The gold tick marks where you should be by today, at an even pace through the season.</p> : null}
          </Panel>
          <Panel title="New goal">
            <GoalForm seasonStart={seasonStart} seasonEnd={seasonEnd} />
          </Panel>
        </div>
        <Panel title="Badges">
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
            {o.badges.map((b) => (
              <div key={b.id} className="flex gap-3 bg-white p-4">
                <span className={`grid h-12 w-12 shrink-0 place-items-center ${b.earned ? "bg-gold" : "bg-paper"}`} aria-hidden>
                  <svg viewBox="0 0 24 24" className={`h-7 w-7 ${b.earned ? "text-navy" : "text-mute"}`}>
                    <path d="M12 2l2.9 6.1 6.6.8-4.9 4.5 1.3 6.6L12 16.8 6.1 20l1.3-6.6L2.5 8.9l6.6-.8z" fill="currentColor" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold uppercase text-navy">{b.title}</p>
                  <p className="text-xs text-slate">{b.detail}</p>
                  <div className="mt-2"><Meter value={b.progress} max={1} tone={b.earned ? "gold" : "navy"} /></div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </Container>
    </>
  );
}
