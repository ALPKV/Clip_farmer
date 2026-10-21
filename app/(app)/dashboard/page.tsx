import type { Metadata } from "next";
import Link from "next/link";
import { WorkloadChart } from "@/components/charts";
import { ButtonLink, Container, Empty, Meter, PageHeader, Panel, Stat, Tag, fmt } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/domain";
import { loadOverview } from "@/lib/overview";

export const metadata: Metadata = { title: "Command Centre" };

const PILLARS = [
  { key: "physical", label: "Physical", hint: "Log a conditioning session: sprints, gym or mobility." },
  { key: "technical", label: "Technical", hint: "Log nets, a drill, machine work or spot bowling." },
  { key: "mental", label: "Mental", hint: "Finish a session with both an intent and a reflection." },
] as const;

export default async function Dashboard() {
  const user = await requireUser();
  const o = await loadOverview(user);
  const spike = o.thisWeek.spike;

  return (
    <>
      <PageHeader
        eyebrow={`Command Centre · ${fmt.date(o.today)}`}
        title={`${user.name.split(" ")[0]}'s week`}
        aside={
          <div className="flex flex-wrap gap-2">
            {o.status.optimal ? <Tag tone="gold">Optimal status</Tag> : <Tag tone="navy">Building · {Object.values(o.status.met).filter(Boolean).length}/3 pillars</Tag>}
            {o.risk ? <Tag tone="risk">High injury risk</Tag> : null}
          </div>
        }
      >
        Your practice, workload and goals at a glance. Plan the next session with a clear intent, and
        log it within two hours of finishing.
      </PageHeader>

      <Container className="space-y-6">
        {o.risk ? (
          <div className="flex flex-wrap items-center gap-4 border-l-4 border-risk bg-white px-4 py-3">
            <Tag tone="risk">Workload alert</Tag>
            <p className="text-sm">
              This week&apos;s load is <b>{spike != null ? `${Math.round(spike * 100)}%` : "well"} above</b> last week, past the 20% safe
              limit. Swap a hard session for recovery or mobility.
            </p>
          </div>
        ) : null}
        {o.overdue.length > 0 ? (
          <div className="flex flex-wrap items-center gap-4 border-l-4 border-warn bg-white px-4 py-3">
            <Tag tone="mute">{o.overdue.length} unlogged</Tag>
            <p className="text-sm">Planned sessions from earlier days were never logged. Delete them or log the next one on time.</p>
            <Link className="ml-auto font-display text-sm font-bold uppercase text-navy underline" href="/planner">Open planner</Link>
          </div>
        ) : null}

        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Load this week" value={o.thisWeek.load} unit="AU" tone={o.risk ? "risk" : "default"}
            note={o.lastWeek.load ? `Last week ${o.lastWeek.load} AU${spike != null ? ` · ${spike >= 0 ? "+" : ""}${Math.round(spike * 100)}%` : ""}` : "Minutes × effort (RPE)"} />
          <Stat label="Sessions this week" value={o.thisWeek.sessions} note={`${Math.round(o.thisWeek.minutes / 6) / 10} hours`} />
          <Stat label="Practice streak" value={o.streak} unit={o.streak === 1 ? "day" : "days"} note="Consecutive days with a logged session" />
          <Stat label="Top speed" value={fmt.num(o.topSpeed)} unit="km/h" note={o.avgSpeed ? `Average ${o.avgSpeed.toFixed(0)} km/h` : "From Ball Tracking"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Panel title="Workload · last 8 weeks" action={<span className="text-xs text-mute">Red = more than 20% up on the week before</span>}>
            {o.loads.some((l) => l.load > 0) ? (
              <WorkloadChart loads={o.loads} />
            ) : (
              <Empty title="No load yet">Log a session with its duration and effort (RPE) to start your workload history.</Empty>
            )}
          </Panel>
          <Panel title="Three pillars · last 7 days">
            <ul className="divide-y divide-line">
              {PILLARS.map((p) => {
                const met = o.status.met[p.key];
                return (
                  <li key={p.key} className="flex items-start gap-3 py-3">
                    <span aria-hidden className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center font-display font-extrabold ${met ? "bg-ok text-white" : "bg-paper text-mute"}`}>
                      {met ? "✓" : "–"}
                    </span>
                    <div>
                      <p className="font-display text-lg font-bold uppercase text-navy">{p.label}</p>
                      <p className="text-sm text-slate">{met ? "Covered this week." : p.hint}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-mute">All three in the same 7 days unlocks Optimal status.</p>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Next up" action={<ButtonLink size="sm" tone="ghost" href="/planner">Plan session</ButtonLink>}>
            {o.upcoming.length === 0 ? (
              <Empty title="Nothing planned">Professionals plan their nets before they arrive. Set your next session and its intent.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {o.upcoming.slice(0, 4).map((s) => (
                  <li key={s.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-display text-lg font-bold uppercase text-navy">{s.title || CATEGORIES[s.category].label}</p>
                      <span className="text-sm text-slate">{s.date === o.today ? "Today" : fmt.date(s.date)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate"><span className="eyebrow mr-2 text-mute">Intent</span>{s.intent}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Season goals" action={<ButtonLink size="sm" tone="ghost" href="/goals">All goals</ButtonLink>}>
            {o.goals.length === 0 ? (
              <Empty title="No goals set">Set realistic, measurable targets at the start of the season.</Empty>
            ) : (
              <ul className="space-y-4">
                {o.goals.slice(0, 4).map((g) => (
                  <li key={g.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-semibold">{g.title}</p>
                      <p className="font-display font-bold tabular-nums text-navy">
                        {fmt.num(g.current, g.metric === "practice_hours" ? 1 : 0)} / {g.target} {g.unit}
                      </p>
                    </div>
                    <div className="mt-1.5"><Meter value={g.current} max={g.target} tone={g.current >= g.target ? "ok" : "navy"} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Achievements" action={<ButtonLink size="sm" tone="ghost" href="/goals">Badges</ButtonLink>}>
          <div className="grid gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
            {o.badges.slice(0, 5).map((b) => (
              <div key={b.id} className={`bg-white p-3 ${b.earned ? "" : "opacity-60"}`}>
                <p className="font-display font-bold uppercase text-navy">{b.title}</p>
                <p className="text-xs text-slate">{b.detail}</p>
                <div className="mt-2"><Meter value={b.progress} max={1} tone={b.earned ? "gold" : "navy"} /></div>
              </div>
            ))}
          </div>
        </Panel>
      </Container>
    </>
  );
}
