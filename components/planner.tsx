"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_KEYS, CONDITIONING_TYPES, sessionLoad, type Category, type PracticeSession } from "@/lib/domain";
import { FormError, useSend } from "./use-send";
import { Button, Empty, Panel, Tag, fmt } from "./ui";

type DetailField = { key: string; label: string; type: "text" | "number" | "select"; options?: readonly string[]; min?: number; max?: number };

const DETAILS: Record<Category, DetailField[]> = {
  open_nets: [{ key: "focus", label: "Focus", type: "text" }],
  scenario_nets: [
    { key: "scenario", label: "Scenario", type: "text" },
    { key: "result", label: "Outcome", type: "select", options: ["Won", "Lost", "Tied", "Not finished"] },
  ],
  technical_drill: [
    { key: "drill", label: "Drill", type: "text" },
    { key: "reps", label: "Reps", type: "number", min: 0, max: 2000 },
  ],
  bowling_machine: [
    { key: "balls", label: "Balls faced", type: "number", min: 0, max: 2000 },
    { key: "speed_kmh", label: "Machine speed (km/h)", type: "number", min: 20, max: 170 },
  ],
  spot_bowling: [
    { key: "target", label: "Target", type: "select", options: ["Yorker", "Full", "Good length", "Back of length", "Short", "Wide yorker"] },
    { key: "attempts", label: "Balls bowled", type: "number", min: 1, max: 500 },
    { key: "hits", label: "On target", type: "number", min: 0, max: 500 },
  ],
  skill_development: [
    { key: "skill", label: "New skill", type: "text" },
    { key: "confidence", label: "Confidence (1–5)", type: "number", min: 1, max: 5 },
  ],
  conditioning: [
    { key: "type", label: "Type", type: "select", options: CONDITIONING_TYPES },
    { key: "notes", label: "Workout", type: "text" },
  ],
};

const GROUPS = [...new Set(CATEGORY_KEYS.map((k) => CATEGORIES[k].group))];

function nowLocalInput() {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function readDetails(form: FormData, category: Category) {
  const out: Record<string, string | number> = {};
  for (const f of DETAILS[category]) {
    const raw = String(form.get(`d_${f.key}`) ?? "").trim();
    if (!raw) continue;
    out[f.key] = f.type === "number" ? Number(raw) : raw;
  }
  return out;
}

export function SessionForm({ today }: { today: string }) {
  const { send, error, busy, setError } = useSend();
  const [mode, setMode] = useState<"plan" | "log">("plan");
  const [category, setCategory] = useState<Category>("open_nets");
  const [rpe, setRpe] = useState(6);
  const [key, setKey] = useState(0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const details = readDetails(f, category);
    if (category === "spot_bowling" && Number(details.hits ?? 0) > Number(details.attempts ?? 0)) {
      setError("On-target balls can't exceed balls bowled.");
      return;
    }
    const finishedLocal = String(f.get("finished") ?? "");
    const ok = await send("POST", "/api/practice", {
      date: String(f.get("date")),
      category,
      title: String(f.get("title") ?? ""),
      planned_minutes: f.get("planned") ? Number(f.get("planned")) : null,
      intent: String(f.get("intent") ?? ""),
      details,
      completion:
        mode === "log"
          ? {
              duration_min: Number(f.get("duration")),
              rpe,
              reflection: String(f.get("reflection") ?? ""),
              completed_at: new Date(finishedLocal).toISOString(),
            }
          : null,
    });
    if (ok) setKey((k) => k + 1);
  }

  return (
    <Panel title={mode === "plan" ? "Plan a session" : "Log a session"}>
      <div className="mb-4 grid grid-cols-2 border border-navy">
        {(["plan", "log"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`py-2 font-display text-sm font-bold uppercase tracking-wider ${mode === m ? "bg-navy text-white" : "bg-white text-navy"}`}
          >
            {m === "plan" ? "Plan ahead" : "Just finished"}
          </button>
        ))}
      </div>
      <form key={key} onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="label">Session type</legend>
          <div className="space-y-2">
            {GROUPS.map((g) => (
              <div key={g} className="flex flex-wrap items-center gap-1.5">
                <span className="w-28 text-xs text-mute">{g}</span>
                {CATEGORY_KEYS.filter((k) => CATEGORIES[k].group === g).map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setCategory(k)}
                    className={`border px-2.5 py-1 text-sm ${category === k ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-navy"}`}
                  >
                    {CATEGORIES[k].label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="sm:col-span-1">
            <span className="label">Date</span>
            <input className="field" type="date" name="date" defaultValue={today} max={mode === "log" ? today : undefined} required />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Title (optional)</span>
            <input className="field" name="title" maxLength={120} placeholder={CATEGORIES[category].label} />
          </label>
        </div>
        <label className="block">
          <span className="label">Pre-session intent</span>
          <textarea
            className="field min-h-[72px]"
            name="intent"
            required
            minLength={3}
            maxLength={1000}
            placeholder="How will you approach it? e.g. Stay side-on and leave anything outside off."
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {DETAILS[category].map((d) => (
            <label key={d.key}>
              <span className="label">{d.label}</span>
              {d.type === "select" ? (
                <select className="field" name={`d_${d.key}`} defaultValue="">
                  <option value="">—</option>
                  {d.options!.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input className="field" name={`d_${d.key}`} type={d.type} min={d.min} max={d.max} maxLength={300} />
              )}
            </label>
          ))}
          {mode === "plan" ? (
            <label>
              <span className="label">Planned minutes</span>
              <input className="field" type="number" name="planned" min={1} max={600} />
            </label>
          ) : null}
        </div>
        {mode === "log" ? (
          <div className="space-y-4 border-t border-line pt-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Minutes</span>
                <input className="field" type="number" name="duration" min={1} max={600} required />
              </label>
              <label>
                <span className="label">Finished at</span>
                <input className="field" type="datetime-local" name="finished" defaultValue={nowLocalInput()} required />
              </label>
            </div>
            <RpeInput value={rpe} onChange={setRpe} />
            <label className="block">
              <span className="label">Post-session reflection</span>
              <textarea className="field min-h-[72px]" name="reflection" maxLength={2000} placeholder="What did you learn? What changes next time?" />
            </label>
            <p className="text-xs text-mute">Sessions must be logged within 2 hours of finishing.</p>
          </div>
        ) : null}
        <FormError error={error} />
        <Button type="submit" tone="gold" disabled={busy} className="w-full">
          {mode === "plan" ? "Add to plan" : "Log session"}
        </Button>
      </form>
    </Panel>
  );
}

export function RpeInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const words = ["", "Very easy", "Easy", "Moderate", "Somewhat hard", "Hard", "Hard", "Very hard", "Very hard", "Near max", "Maximal"];
  return (
    <fieldset>
      <legend className="label">Effort (RPE 1–10): <span className="text-navy">{value} · {words[value]}</span></legend>
      <div className="grid grid-cols-10 gap-0.5">
        {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={`h-9 font-display font-bold ${n <= value ? (n >= 8 ? "bg-risk text-white" : n >= 5 ? "bg-gold text-navy-950" : "bg-navy text-white") : "bg-paper text-mute"}`}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function PlannedList({ sessions, today }: { sessions: PracticeSession[]; today: string }) {
  const { send } = useSend();
  const [open, setOpen] = useState<string | null>(null);
  if (sessions.length === 0) {
    return <Empty title="No planned sessions">Plan ahead so you arrive at nets with a purpose.</Empty>;
  }
  return (
    <ul className="divide-y divide-line">
      {sessions.map((s) => (
        <li key={s.id} className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-display text-lg font-bold uppercase text-navy">{s.title || CATEGORIES[s.category].label}</p>
              <p className="text-xs text-slate">
                {s.date === today ? "Today" : fmt.date(s.date)} · {CATEGORIES[s.category].label}
                {s.planned_minutes ? ` · ${s.planned_minutes} min` : ""}
                {s.date < today ? " · " : ""}
                {s.date < today ? <span className="text-risk">missed</span> : null}
              </p>
            </div>
            <div className="flex gap-1.5">
              {s.date <= today ? (
                <Button size="sm" tone={open === s.id ? "gold" : "ghost"} onClick={() => setOpen(open === s.id ? null : s.id)}>
                  Log it
                </Button>
              ) : null}
              <Button size="sm" tone="danger" onClick={() => send("DELETE", `/api/practice/${s.id}`)}>Delete</Button>
            </div>
          </div>
          <p className="mt-1.5 text-sm"><span className="eyebrow mr-2 text-mute">Intent</span>{s.intent}</p>
          {open === s.id ? <CompleteForm session={s} onDone={() => setOpen(null)} /> : null}
        </li>
      ))}
    </ul>
  );
}

function CompleteForm({ session, onDone }: { session: PracticeSession; onDone: () => void }) {
  const { send, error, busy } = useSend();
  const [rpe, setRpe] = useState(6);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await send("PATCH", `/api/practice/${session.id}`, {
      duration_min: Number(f.get("duration")),
      rpe,
      reflection: String(f.get("reflection") ?? ""),
      completed_at: new Date(String(f.get("finished"))).toISOString(),
    });
    if (ok) onDone();
  }
  return (
    <form onSubmit={submit} className="mt-3 space-y-3 border-l-4 border-gold bg-paper p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Minutes</span>
          <input className="field" type="number" name="duration" min={1} max={600} defaultValue={session.planned_minutes ?? undefined} required />
        </label>
        <label>
          <span className="label">Finished at</span>
          <input className="field" type="datetime-local" name="finished" defaultValue={nowLocalInput()} required />
        </label>
      </div>
      <RpeInput value={rpe} onChange={setRpe} />
      <label className="block">
        <span className="label">Reflection: did you stick to your intent?</span>
        <textarea className="field min-h-[64px]" name="reflection" maxLength={2000} />
      </label>
      <FormError error={error} />
      <Button type="submit" tone="navy" size="sm" disabled={busy}>Save log</Button>
    </form>
  );
}

export function CompletedTable({ sessions }: { sessions: PracticeSession[] }) {
  const { send } = useSend();
  if (sessions.length === 0) return <div className="p-4"><Empty title="No sessions logged yet" /></div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-navy text-left font-display text-[0.8rem] uppercase tracking-wider text-white">
            <th className="px-4 py-2">Date</th>
            <th className="px-2 py-2">Session</th>
            <th className="px-2 py-2">Min</th>
            <th className="px-2 py-2">RPE</th>
            <th className="px-2 py-2">Load</th>
            <th className="px-2 py-2">Detail</th>
            <th className="px-2 py-2">Reflection</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {sessions.map((s, k) => (
            <tr key={s.id} className={`border-b border-line align-top ${k % 2 ? "bg-paper/60" : ""}`}>
              <td className="whitespace-nowrap px-4 py-2">{fmt.date(s.date)}</td>
              <td className="px-2 py-2">
                <p className="font-semibold">{s.title || CATEGORIES[s.category].label}</p>
                <p className="text-xs text-slate">{CATEGORIES[s.category].label}</p>
              </td>
              <td className="px-2 py-2 tabular-nums">{s.duration_min}</td>
              <td className="px-2 py-2 tabular-nums">{s.rpe}</td>
              <td className="px-2 py-2 font-display font-bold tabular-nums text-navy">{sessionLoad(s)}</td>
              <td className="px-2 py-2 text-xs text-slate"><DetailSummary s={s} /></td>
              <td className="max-w-[280px] px-2 py-2 text-xs text-slate">{s.reflection || <Tag tone="mute">none</Tag>}</td>
              <td className="px-4 py-2 text-right">
                <button className="text-mute hover:text-risk" aria-label="Delete session" onClick={() => send("DELETE", `/api/practice/${s.id}`)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailSummary({ s }: { s: PracticeSession }) {
  const d = s.details as Record<string, string | number>;
  if (s.category === "spot_bowling" && d.attempts) {
    const pct = Math.round((Number(d.hits ?? 0) / Number(d.attempts)) * 100);
    return <>{d.target ?? "Target"}: {d.hits ?? 0}/{d.attempts} <b className="text-navy">({pct}%)</b></>;
  }
  if (s.category === "bowling_machine") return <>{d.balls ?? "?"} balls{d.speed_kmh ? ` @ ${d.speed_kmh} km/h` : ""}</>;
  const parts = Object.entries(d).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
  return <>{parts.join(" · ") || "—"}</>;
}
