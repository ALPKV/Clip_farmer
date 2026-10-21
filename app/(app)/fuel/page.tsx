import type { Metadata } from "next";
import Link from "next/link";
import { CarbForm, DeleteButton } from "@/components/forms";
import { Container, Empty, Meter, PageHeader, Panel, Stat, Tag, fmt } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listCarbs, listMatches, listPractice, serverToday } from "@/lib/data";
import { addDays, CARB_RANGES, dayType } from "@/lib/domain";

export const metadata: Metadata = { title: "Fuel" };

export default async function FuelPage() {
  const user = await requireUser();
  const today = await serverToday();
  const [carbs, practice, matches] = await Promise.all([listCarbs(user.id, addDays(today, -13)), listPractice(user.id), listMatches(user.id)]);
  const days = Array.from({ length: 7 }, (_, k) => addDays(today, k - 6));
  const typeOf = (d: string) => dayType(practice.filter((s) => s.date === d), matches.some((m) => m.date === d));
  const totalOf = (d: string) => carbs.filter((c) => c.date === d).reduce((a, c) => a + c.carbs_g, 0);
  const w = user.weight_kg;
  const todayType = typeOf(today);
  const range = CARB_RANGES[todayType];
  const todayTotal = totalOf(today);
  const target = w ? { min: Math.round(range.min * w), max: Math.round(range.max * w) } : null;

  return (
    <>
      <PageHeader eyebrow="Nutritional fuelling" title="Carb tracker">
        Fuel for the work you&apos;re doing. Targets scale with your body weight and with how hard
        today is: rest, training or match day.
      </PageHeader>
      <Container className="space-y-6">
        {!w ? (
          <div className="flex flex-wrap items-center gap-3 border-l-4 border-gold bg-white px-4 py-3 text-sm">
            <Tag tone="gold">Set up</Tag>
            Add your body weight in your <Link className="font-semibold text-navy underline" href="/profile">profile</Link> to get daily targets.
          </div>
        ) : null}
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <Stat label="Today" value={Math.round(todayTotal)} unit="g" tone="dark" note={range.label} />
          <Stat label="Today's target" value={target ? `${target.min}–${target.max}` : "—"} unit="g" note={`${range.min}–${range.max} g per kg body weight`} />
          <Stat
            label="Status"
            value={!target ? "—" : todayTotal < target.min ? "Under" : todayTotal > target.max ? "Over" : "Fuelled"}
            tone={!target ? "default" : todayTotal >= target.min && todayTotal <= target.max ? "ok" : "default"}
            note={target && todayTotal < target.min ? `${target.min - Math.round(todayTotal)} g to go` : undefined}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Panel title="Log food">
            <CarbForm today={today} />
          </Panel>
          <Panel title="Last 7 days">
            <ul className="space-y-3">
              {days.map((d) => {
                const t = typeOf(d);
                const total = totalOf(d);
                const max = w ? CARB_RANGES[t].max * w : Math.max(400, total);
                const min = w ? CARB_RANGES[t].min * w : 0;
                return (
                  <li key={d}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="w-28 font-semibold">{d === today ? "Today" : fmt.date(d)}</span>
                      <span className="flex-1 text-xs text-slate">{CARB_RANGES[t].label}</span>
                      <span className="font-display font-bold tabular-nums text-navy">{Math.round(total)} g</span>
                    </div>
                    <div className="mt-1"><Meter value={total} max={max} tone={w && total >= min ? "ok" : "gold"} /></div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
        <Panel title="Food log" flush>
          {carbs.length === 0 ? (
            <div className="p-4"><Empty title="Nothing logged" /></div>
          ) : (
            <ul className="divide-y divide-line">
              {carbs.slice(0, 30).map((c) => (
                <li key={c.id} className="flex items-center gap-4 px-4 py-2 text-sm">
                  <span className="w-28 text-slate">{fmt.date(c.date)}</span>
                  <Tag tone="mute">{c.timing}</Tag>
                  <span className="flex-1">{c.meal}</span>
                  <span className="font-display font-bold tabular-nums text-navy">{c.carbs_g} g</span>
                  <DeleteButton url={`/api/carbs/${c.id}`} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <p className="text-xs text-mute">
          Ranges follow general sports-nutrition guidance (about 3–5 g/kg on light days, 5–7 g/kg for training, 6–10 g/kg for
          matches and heavy blocks). They are not medical advice. Talk to a qualified nutritionist about your own needs.
        </p>
      </Container>
    </>
  );
}
