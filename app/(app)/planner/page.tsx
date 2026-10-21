import type { Metadata } from "next";
import { CompletedTable, PlannedList, SessionForm } from "@/components/planner";
import { Container, PageHeader, Panel, Stat } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listPractice, serverToday } from "@/lib/data";
import { addDays } from "@/lib/domain";

export const metadata: Metadata = { title: "Planner" };

export default async function PlannerPage() {
  const user = await requireUser();
  const [sessions, today] = await Promise.all([listPractice(user.id), serverToday()]);
  const planned = sessions.filter((s) => s.status === "planned").sort((a, b) => a.date.localeCompare(b.date));
  const done = sessions.filter((s) => s.status === "completed");
  const spot = done.filter((s) => s.category === "spot_bowling" && s.date >= addDays(today, -27));
  const attempts = spot.reduce((a, s) => a + Number((s.details as Record<string, number>).attempts ?? 0), 0);
  const hits = spot.reduce((a, s) => a + Number((s.details as Record<string, number>).hits ?? 0), 0);
  const machine = done.filter((s) => s.category === "bowling_machine" && s.date >= addDays(today, -27));
  const machineBalls = machine.reduce((a, s) => a + Number((s.details as Record<string, number>).balls ?? 0), 0);

  return (
    <>
      <PageHeader eyebrow="Elite practice planner" title="Planner">
        Every session gets a purpose before it starts and a reflection after it ends. Nets, drills,
        machine work, spot bowling, new skills and conditioning.
      </PageHeader>
      <Container className="space-y-6">
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <Stat label="Planned" value={planned.length} note="Sessions waiting to be done" />
          <Stat label="Spot bowling · 4 wks" value={attempts ? `${Math.round((hits / attempts) * 100)}%` : "—"} note={attempts ? `${hits} of ${attempts} on target` : "Log spot bowling to track accuracy"} />
          <Stat label="Machine balls · 4 wks" value={machineBalls} note={`${machine.length} sessions`} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <SessionForm today={today} />
          <Panel title="Planned sessions">
            <PlannedList sessions={planned} today={today} />
          </Panel>
        </div>
        <Panel title="Session log" flush>
          <CompletedTable sessions={done.slice(0, 40)} />
        </Panel>
      </Container>
    </>
  );
}
