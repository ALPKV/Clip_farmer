import type { Metadata } from "next";
import Link from "next/link";
import { WorkloadChart } from "@/components/charts";
import { Container, PageHeader, Panel, Stat, Tag } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listMatches, listPractice, serverToday } from "@/lib/data";
import { addDays, CATEGORIES, sessionLoad, weeklyLoads, weekStart } from "@/lib/domain";

export const metadata: Metadata = { title: "Calendar" };

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const [sessions, matches, today] = await Promise.all([listPractice(user.id), listMatches(user.id), serverToday()]);
  const { m } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(m ?? "") ? m! : today.slice(0, 7);
  const first = `${month}-01`;
  const gridStart = weekStart(first);
  const nextMonth = new Date(`${first}T00:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const next = nextMonth.toISOString().slice(0, 7);
  const prevMonth = new Date(`${first}T00:00:00Z`);
  prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
  const prev = prevMonth.toISOString().slice(0, 7);
  const days = Array.from({ length: 42 }, (_, k) => addDays(gridStart, k));
  const title = new Date(`${first}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  const inMonth = (d: string) => d.startsWith(month);
  const monthDone = sessions.filter((s) => s.status === "completed" && inMonth(s.date));
  const activeDays = new Set([...monthDone.map((s) => s.date), ...matches.filter((x) => inMonth(x.date)).map((x) => x.date)]);
  const elapsed = days.filter((d) => inMonth(d) && d <= today).length;
  const hours = monthDone.reduce((a, s) => a + (s.duration_min ?? 0), 0) / 60;

  return (
    <>
      <PageHeader eyebrow="Workload & recovery" title="Calendar">
        Training and rest across the month. Balance hard days with recovery, and watch for weeks
        that jump more than 20% on the week before.
      </PageHeader>
      <Container className="space-y-6">
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <Stat label="Hours this month" value={hours.toFixed(1)} note={`${monthDone.length} sessions`} />
          <Stat label="Training days" value={activeDays.size} note={`of ${elapsed} days so far`} />
          <Stat label="Rest days" value={Math.max(0, elapsed - [...activeDays].filter((d) => d <= today).length)} note="Recovery is part of the plan" tone="ok" />
        </div>

        <Panel
          title={title}
          flush
          action={
            <div className="flex gap-1">
              <Link href={`/calendar?m=${prev}`} className="border border-line px-3 py-1 font-display text-sm font-bold uppercase text-navy hover:border-navy">Prev</Link>
              <Link href="/calendar" className="border border-line px-3 py-1 font-display text-sm font-bold uppercase text-navy hover:border-navy">Today</Link>
              <Link href={`/calendar?m=${next}`} className="border border-line px-3 py-1 font-display text-sm font-bold uppercase text-navy hover:border-navy">Next</Link>
            </div>
          }
        >
          <div className="grid grid-cols-7 bg-navy text-center font-display text-xs font-bold uppercase tracking-wider text-white">
            {DOW.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px bg-line">
            {days.map((d) => {
              const ds = sessions.filter((s) => s.date === d);
              const match = matches.filter((x) => x.date === d);
              const load = ds.reduce((a, s) => a + sessionLoad(s), 0);
              return (
                <div key={d} className={`min-h-[96px] p-1.5 ${inMonth(d) ? "bg-white" : "bg-paper text-mute"} ${d === today ? "ring-2 ring-inset ring-gold" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold">{Number(d.slice(8))}</span>
                    {load > 0 ? <span className="text-[0.7rem] tabular-nums text-slate">{load}</span> : null}
                  </div>
                  <ul className="mt-1 space-y-0.5">
                    {match.map((x) => (
                      <li key={x.id} className="truncate bg-gold px-1 text-[0.7rem] font-semibold text-navy-950">Match{x.opponent ? ` v ${x.opponent}` : ""}</li>
                    ))}
                    {ds.slice(0, 3).map((s) => (
                      <li
                        key={s.id}
                        className={`truncate px-1 text-[0.7rem] ${
                          s.status === "planned"
                            ? "border border-dashed border-navy/40 text-navy"
                            : CATEGORIES[s.category].pillar === "physical"
                              ? "bg-ok text-white"
                              : "bg-navy text-white"
                        }`}
                      >
                        {CATEGORIES[s.category].label}
                      </li>
                    ))}
                    {ds.length > 3 ? <li className="text-[0.7rem] text-slate">+{ds.length - 3} more</li> : null}
                  </ul>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 px-4 py-3 text-xs text-slate">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-navy" /> Skill session</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-ok" /> Conditioning</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 border border-dashed border-navy/40" /> Planned</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-gold" /> Match</span>
            <span className="ml-auto">Number in the corner = load (minutes × RPE)</span>
          </div>
        </Panel>

        <Panel title="Weekly load" action={weeklyLoads(sessions, today, 8).at(-1)?.risk ? <Tag tone="risk">High injury risk</Tag> : null}>
          <WorkloadChart loads={weeklyLoads(sessions, today, 8)} />
        </Panel>
      </Container>
    </>
  );
}
