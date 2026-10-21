"use client";

import { useState } from "react";
import type { User } from "@/lib/auth";
import { FormError, useSend } from "./use-send";
import { Button } from "./ui";

export function DeleteButton({ url, label = "Delete" }: { url: string; label?: string }) {
  const { send, busy } = useSend();
  return (
    <button disabled={busy} className="text-mute hover:text-risk disabled:opacity-40" aria-label={label} title={label} onClick={() => send("DELETE", url)}>
      ×
    </button>
  );
}

export function InventoryForm() {
  const { send, error, busy } = useSend();
  const [key, setKey] = useState(0);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (await send("POST", "/api/mindset", { kind: f.get("kind"), pillar: f.get("pillar"), text: f.get("text") })) setKey((k) => k + 1);
  }
  return (
    <form key={key} onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">This is a…</span>
          <select className="field" name="kind" defaultValue="strength">
            <option value="strength">Strength</option>
            <option value="weakness">Weakness</option>
          </select>
        </label>
        <label>
          <span className="label">Area</span>
          <select className="field" name="pillar" defaultValue="technical">
            <option value="technical">Technical</option>
            <option value="tactical">Tactical</option>
            <option value="mental">Mental</option>
            <option value="physical">Physical</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="label">Describe it</span>
        <input className="field" name="text" required minLength={2} maxLength={300} placeholder="e.g. Late cut against spin" />
      </label>
      <FormError error={error} />
      <Button type="submit" tone="navy" size="sm" disabled={busy}>Add to inventory</Button>
    </form>
  );
}

export function GoalForm({ seasonStart, seasonEnd }: { seasonStart: string; seasonEnd: string }) {
  const { send, error, busy } = useSend();
  const [metric, setMetric] = useState("runs");
  const [key, setKey] = useState(0);
  const units: Record<string, string> = { runs: "runs", wickets: "wkts", practice_hours: "hrs", sessions: "sessions", custom: "" };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await send("POST", "/api/goals", {
      title: f.get("title"),
      metric,
      unit: metric === "custom" ? String(f.get("unit") ?? "") : units[metric],
      target: Number(f.get("target")),
      baseline: Number(f.get("baseline") || 0),
      season_start: f.get("season_start"),
      season_end: f.get("season_end"),
    });
    if (ok) setKey((k) => k + 1);
  }
  return (
    <form key={key} onSubmit={submit} className="space-y-3">
      <label className="block">
        <span className="label">Goal</span>
        <input className="field" name="title" required minLength={2} maxLength={120} placeholder="e.g. 2000 runs this season" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Measured by</span>
          <select className="field" value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="runs">Match runs (automatic)</option>
            <option value="wickets">Match wickets (automatic)</option>
            <option value="practice_hours">Practice hours (automatic)</option>
            <option value="sessions">Sessions completed (automatic)</option>
            <option value="custom">Something else (update by hand)</option>
          </select>
        </label>
        {metric === "custom" ? (
          <label><span className="label">Unit</span><input className="field" name="unit" maxLength={20} placeholder="e.g. kg, km/h" /></label>
        ) : null}
        <label><span className="label">Target</span><input className="field" type="number" name="target" min={1} step="any" required /></label>
        <label><span className="label">Already at (optional)</span><input className="field" type="number" name="baseline" min={0} step="any" placeholder="0" /></label>
        <label><span className="label">Season start</span><input className="field" type="date" name="season_start" defaultValue={seasonStart} required /></label>
        <label><span className="label">Season end</span><input className="field" type="date" name="season_end" defaultValue={seasonEnd} required /></label>
      </div>
      <p className="text-xs text-mute">Targets are fixed once set, so progress stays honest. Pick one you can reach.</p>
      <FormError error={error} />
      <Button type="submit" tone="gold" disabled={busy} className="w-full">Set goal</Button>
    </form>
  );
}

export function GoalProgressInput({ id, current }: { id: string; current: number }) {
  const { send, error, busy } = useSend();
  const [value, setValue] = useState(String(current));
  return (
    <form
      className="mt-2 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void send("PATCH", `/api/goals/${id}`, { manual_current: Number(value) });
      }}
    >
      <input className="field h-8 w-28 py-1" type="number" min={0} step="any" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Current value" />
      <Button size="sm" tone="ghost" disabled={busy}>Update</Button>
      <FormError error={error} />
    </form>
  );
}

export function CarbForm({ today }: { today: string }) {
  const { send, error, busy } = useSend();
  const [key, setKey] = useState(0);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await send("POST", "/api/carbs", {
      date: f.get("date"),
      meal: f.get("meal"),
      carbs_g: Number(f.get("carbs_g")),
      timing: f.get("timing"),
    });
    if (ok) setKey((k) => k + 1);
  }
  return (
    <form key={key} onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Date</span><input className="field" type="date" name="date" defaultValue={today} required /></label>
        <label>
          <span className="label">When</span>
          <select className="field" name="timing" defaultValue="meal">
            <option value="meal">Meal</option>
            <option value="snack">Snack</option>
            <option value="pre">Before training</option>
            <option value="during">During training</option>
            <option value="post">After training</option>
          </select>
        </label>
      </div>
      <label className="block"><span className="label">Food</span><input className="field" name="meal" required maxLength={120} placeholder="e.g. Rice and dal" /></label>
      <label className="block"><span className="label">Carbohydrate (g)</span><input className="field" type="number" name="carbs_g" min={0} max={1000} required /></label>
      <FormError error={error} />
      <Button type="submit" tone="gold" disabled={busy} className="w-full">Add</Button>
    </form>
  );
}

export function ProfileForm({ user }: { user: User }) {
  const { send, error, busy } = useSend();
  const [saved, setSaved] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const weight = String(f.get("weight_kg") || "");
    const ok = await send("PATCH", "/api/profile", {
      name: f.get("name"),
      role: f.get("role"),
      weight_kg: weight ? Number(weight) : null,
      season_start: f.get("season_start") || null,
      season_end: f.get("season_end") || null,
    });
    setSaved(ok);
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Name</span><input className="field" name="name" defaultValue={user.name} required maxLength={80} /></label>
        <label>
          <span className="label">Role</span>
          <select className="field" name="role" defaultValue={user.role}>
            <option value="batter">Batter</option>
            <option value="bowler">Bowler</option>
            <option value="all-rounder">All-rounder</option>
            <option value="wicketkeeper">Wicketkeeper</option>
          </select>
        </label>
        <label><span className="label">Body weight (kg)</span><input className="field" type="number" name="weight_kg" min={25} max={200} step="0.1" defaultValue={user.weight_kg ?? ""} /></label>
        <span />
        <label><span className="label">Season start</span><input className="field" type="date" name="season_start" defaultValue={user.season_start ?? ""} /></label>
        <label><span className="label">Season end</span><input className="field" type="date" name="season_end" defaultValue={user.season_end ?? ""} /></label>
      </div>
      <FormError error={error} />
      <div className="flex items-center gap-3">
        <Button type="submit" tone="navy" disabled={busy}>Save profile</Button>
        {saved ? <span className="text-sm text-ok">Saved</span> : null}
      </div>
    </form>
  );
}
