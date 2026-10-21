import type { Metadata } from "next";
import { DeleteButton, InventoryForm } from "@/components/forms";
import { Container, Empty, PageHeader, Panel, Stat, Tag, fmt } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listInventory, listPractice } from "@/lib/data";
import { CATEGORIES } from "@/lib/domain";

export const metadata: Metadata = { title: "Mindset" };

export default async function MindsetPage() {
  const user = await requireUser();
  const [items, sessions] = await Promise.all([listInventory(user.id), listPractice(user.id)]);
  const strengths = items.filter((i) => i.kind === "strength");
  const weaknesses = items.filter((i) => i.kind === "weakness");
  const done = sessions.filter((s) => s.status === "completed");
  const reflected = done.filter((s) => s.reflection.trim());

  return (
    <>
      <PageHeader eyebrow="Mental conditioning & strategy" title="Mindset">
        Know your game. Keep a living list of strengths and weaknesses, set an intent before every
        session and reflect after it.
      </PageHeader>
      <Container className="space-y-6">
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <Stat label="Strengths" value={strengths.length} />
          <Stat label="Work-ons" value={weaknesses.length} />
          <Stat label="Reflection rate" value={done.length ? `${Math.round((reflected.length / done.length) * 100)}%` : "—"} note={`${reflected.length} of ${done.length} sessions reflected on`} />
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel title="Add to inventory">
            <InventoryForm />
          </Panel>
          {[
            { title: "Strengths", list: strengths, tone: "ok" as const },
            { title: "Work-ons", list: weaknesses, tone: "risk" as const },
          ].map((col) => (
            <Panel key={col.title} title={col.title}>
              {col.list.length === 0 ? (
                <Empty title={`No ${col.title.toLowerCase()} yet`} />
              ) : (
                <ul className="divide-y divide-line">
                  {col.list.map((i) => (
                    <li key={i.id} className="flex items-start justify-between gap-3 py-2.5">
                      <div>
                        <p className="text-sm font-semibold">{i.text}</p>
                        <Tag tone={col.tone === "ok" ? "ok" : "mute"}>{i.pillar}</Tag>
                      </div>
                      <DeleteButton url={`/api/mindset/${i.id}`} label="Remove" />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ))}
        </div>
        <Panel title="Intent vs reflection">
          {done.length === 0 ? (
            <Empty title="No sessions logged yet">Your intents and reflections will line up here, session by session.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {done.slice(0, 15).map((s) => (
                <li key={s.id} className="grid gap-3 py-3 md:grid-cols-[160px_1fr_1fr]">
                  <div>
                    <p className="font-display font-bold uppercase text-navy">{s.title || CATEGORIES[s.category].label}</p>
                    <p className="text-xs text-slate">{fmt.date(s.date)} · RPE {s.rpe}</p>
                  </div>
                  <p className="text-sm"><span className="eyebrow block text-mute">Intent</span>{s.intent}</p>
                  <p className="text-sm"><span className="eyebrow block text-mute">Reflection</span>{s.reflection || <span className="text-mute">Not written</span>}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Container>
    </>
  );
}
