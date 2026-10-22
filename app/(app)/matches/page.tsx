import type { Metadata } from "next";
import { TrendChart } from "@/components/charts";
import { DeleteMatch, HowOut, MatchForm } from "@/components/match-form";
import { Container, Empty, Meter, PageHeader, Panel, Stat, fmt } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listMatches, serverToday } from "@/lib/data";
import { economy, oversText, strikeRate } from "@/lib/domain";

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage() {
  const user = await requireUser();
  const [matches, today] = await Promise.all([listMatches(user.id), serverToday()]);
  const innings = matches.filter((m) => m.batted);
  const runs = innings.reduce((a, m) => a + m.runs, 0);
  const balls = innings.reduce((a, m) => a + m.balls_faced, 0);
  const outs = innings.filter((m) => !m.not_out).length;
  const bowled = matches.filter((m) => m.balls_bowled > 0);
  const ballsBowled = bowled.reduce((a, m) => a + m.balls_bowled, 0);
  const conceded = bowled.reduce((a, m) => a + m.runs_conceded, 0);
  const wickets = bowled.reduce((a, m) => a + m.wickets, 0);

  const dismissalCounts = new Map<string, number>();
  for (const m of innings) if (!m.not_out && m.dismissal) dismissalCounts.set(m.dismissal, (dismissalCounts.get(m.dismissal) ?? 0) + 1);
  const dismissals = [...dismissalCounts.entries()].sort((a, b) => b[1] - a[1]);
  const chrono = [...innings].reverse().slice(-16);

  return (
    <>
      <PageHeader eyebrow="Match mission log" title="Matches">
        Record every innings and spell, including what went wrong. Recurring errors show up here,
        and they decide what you practise next.
      </PageHeader>
      <Container className="space-y-6">
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Batting average" value={outs ? (runs / outs).toFixed(1) : runs ? `${runs}*` : "—"} note={`${runs} runs · ${innings.length} inns`} />
          <Stat label="Strike rate" value={fmt.num(strikeRate(runs, balls), 1)} note={`${balls} balls faced`} />
          <Stat label="Wickets" value={wickets} note={`${oversText(ballsBowled)} overs`} />
          <Stat label="Economy" value={fmt.num(economy(conceded, ballsBowled), 2)} note="Runs per over" />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <MatchForm today={today} />
          <div className="space-y-6">
            <Panel title="Runs per innings">
              {chrono.length ? (
                <TrendChart values={chrono.map((m) => m.runs)} labels={chrono.map((m) => m.date.slice(5).replace("-", "/"))} />
              ) : (
                <Empty title="No innings yet" />
              )}
            </Panel>
            <Panel title="How you get out">
              {dismissals.length ? (
                <ul className="space-y-3">
                  {dismissals.map(([d, n]) => (
                    <li key={d}>
                      <div className="flex justify-between text-sm"><span className="font-semibold">{d}</span><span className="tabular-nums text-slate">{n} · {Math.round((n / outs) * 100)}%</span></div>
                      <div className="mt-1"><Meter value={n} max={outs} tone={n === dismissals[0][1] ? "risk" : "navy"} /></div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="No dismissals logged" />
              )}
            </Panel>
          </div>
        </div>

        <Panel title="Error log" >
          {matches.filter((m) => m.dismissal_error).length === 0 ? (
            <Empty title="Nothing recorded">Write down what went wrong after each match. Patterns become practice plans.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {matches.filter((m) => m.dismissal_error).slice(0, 12).map((m) => (
                <li key={m.id} className="flex gap-4 py-2.5 text-sm">
                  <span className="w-24 shrink-0 text-slate">{fmt.date(m.date)}</span>
                  <span className="w-20 shrink-0 font-semibold text-navy">{m.dismissal || "—"}</span>
                  <span>{m.dismissal_error}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Scorecard history" flush>
          {matches.length === 0 ? (
            <div className="p-4"><Empty title="No matches logged" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-navy text-left font-display text-[0.8rem] uppercase tracking-wider text-white">
                    <th className="px-4 py-2">Date</th><th className="px-2 py-2">Opponent</th><th className="px-2 py-2">Fmt</th>
                    <th className="px-2 py-2">Bat</th><th className="px-2 py-2">SR</th><th className="px-2 py-2">Out</th>
                    <th className="px-2 py-2">Bowl</th><th className="px-2 py-2">Econ</th><th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, k) => (
                    <tr key={m.id} className={`border-b border-line ${k % 2 ? "bg-paper/60" : ""}`}>
                      <td className="whitespace-nowrap px-4 py-2">{fmt.date(m.date)}</td>
                      <td className="px-2 py-2">{m.opponent || "—"}</td>
                      <td className="px-2 py-2 text-slate">{m.format}</td>
                      <td className="px-2 py-2 font-display text-base font-bold text-navy">{m.batted ? `${m.runs}${m.not_out ? "*" : ""} (${m.balls_faced})` : "DNB"}</td>
                      <td className="px-2 py-2 tabular-nums">{m.batted ? fmt.num(strikeRate(m.runs, m.balls_faced), 0) : "—"}</td>
                      <td className="px-2 py-2 text-slate">{!m.batted ? "—" : m.not_out ? "not out" : <HowOut id={m.id} dismissal={m.dismissal} />}</td>
                      <td className="px-2 py-2 tabular-nums">{m.balls_bowled ? `${m.wickets}/${m.runs_conceded} (${oversText(m.balls_bowled)})` : "—"}</td>
                      <td className="px-2 py-2 tabular-nums">{fmt.num(economy(m.runs_conceded, m.balls_bowled), 2)}</td>
                      <td className="px-4 py-2 text-right"><DeleteMatch id={m.id} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Container>
    </>
  );
}
