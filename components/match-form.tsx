"use client";

import { useState } from "react";
import { FormError, useSend } from "./use-send";
import { Button, Panel } from "./ui";

export const DISMISSALS = ["Bowled", "Caught", "LBW", "Run out", "Stumped", "Hit wicket", "Other"];

export function MatchForm({ today }: { today: string }) {
  const { send, error, busy } = useSend();
  const [batted, setBatted] = useState(true);
  const [notOut, setNotOut] = useState(false);
  const [key, setKey] = useState(0);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(f.get(k) || 0);
    const overs = String(f.get("overs") || "0");
    const [whole, part] = overs.split(".");
    const balls = Number(whole || 0) * 6 + Math.min(5, Number(part || 0));
    const ok = await send("POST", "/api/matches", {
      date: f.get("date"),
      opponent: f.get("opponent"),
      format: f.get("format"),
      batted,
      runs: n("runs"),
      balls_faced: n("balls_faced"),
      not_out: notOut,
      dismissal: notOut ? "" : String(f.get("dismissal") || ""),
      dismissal_error: String(f.get("dismissal_error") || ""),
      balls_bowled: balls,
      runs_conceded: n("runs_conceded"),
      wickets: n("wickets"),
      notes: f.get("notes"),
    });
    if (ok) setKey((k) => k + 1);
  }

  return (
    <Panel title="Log a match">
      <form key={key} onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label><span className="label">Date</span><input className="field" type="date" name="date" defaultValue={today} max={today} required /></label>
          <label><span className="label">Opponent</span><input className="field" name="opponent" maxLength={120} /></label>
          <label>
            <span className="label">Format</span>
            <select className="field" name="format" defaultValue="T20">
              {["T20", "One-day", "Multi-day", "T10", "Other"].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
        </div>
        <fieldset className="border-t border-line pt-3">
          <legend className="flex items-center gap-3">
            <span className="display text-lg font-bold text-navy">Batting</span>
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={!batted} onChange={(e) => setBatted(!e.target.checked)} /> Did not bat</label>
          </legend>
          {batted ? (
            <div className="mt-2 grid gap-3 sm:grid-cols-4">
              <label><span className="label">Runs</span><input className="field" type="number" name="runs" min={0} max={1000} required /></label>
              <label><span className="label">Balls</span><input className="field" type="number" name="balls_faced" min={0} max={2000} required /></label>
              <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={notOut} onChange={(e) => setNotOut(e.target.checked)} /> Not out</label>
              {!notOut ? (
                <label>
                  <span className="label">How out</span>
                  <select className="field" name="dismissal" defaultValue="Caught">
                    {DISMISSALS.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
        </fieldset>
        <fieldset className="border-t border-line pt-3">
          <legend className="display text-lg font-bold text-navy">Bowling</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <label><span className="label">Overs (e.g. 3.4)</span><input className="field" name="overs" inputMode="decimal" pattern="\d{1,3}(\.[0-5])?" placeholder="0" /></label>
            <label><span className="label">Runs conceded</span><input className="field" type="number" name="runs_conceded" min={0} max={600} /></label>
            <label><span className="label">Wickets</span><input className="field" type="number" name="wickets" min={0} max={10} /></label>
          </div>
        </fieldset>
        <label className="block">
          <span className="label">Error analysis: what went wrong, technically or mentally?</span>
          <textarea className="field min-h-[64px]" name="dismissal_error" maxLength={500} placeholder="e.g. Played across the line to a full ball; head fell over." />
        </label>
        <label className="block">
          <span className="label">Notes</span>
          <textarea className="field min-h-[56px]" name="notes" maxLength={2000} />
        </label>
        <FormError error={error} />
        <Button type="submit" tone="gold" disabled={busy} className="w-full">Save match</Button>
      </form>
    </Panel>
  );
}

export function DeleteMatch({ id }: { id: string }) {
  const { send } = useSend();
  return (
    <button className="text-mute hover:text-risk" aria-label="Delete match" onClick={() => send("DELETE", `/api/matches/${id}`)}>×</button>
  );
}
