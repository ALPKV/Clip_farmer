"use client";

import { useEffect, useState } from "react";
import { CREASE_TO_CREASE_M, PITCH_M, lengthZone } from "@/lib/tracking/metrics";
import { Button, Empty, Meter, Panel, Stat, Tag, fmt } from "../ui";
import { PitchMap } from "./pitch-map";
import { Stage } from "./stage";
import { FileBar, VideoDrop, clock } from "./video-drop";
import { clipMetrics, useVideo, type MarkKey } from "./video-context";

const MARKS: { key: MarkKey; label: string; help: string }[] = [
  { key: "release", label: "Release", help: "The frame the ball leaves the hand (or the machine)." },
  { key: "bounce", label: "Bounce", help: "The frame the ball hits the pitch." },
  { key: "contact", label: "Contact", help: "Bat on ball. Auto-filled from the loudest sound; check it's the bat." },
];

export function BallTracking() {
  const v = useVideo();
  const [calibrating, setCalibrating] = useState<number[] | null>(null);

  const clip = v.clips.find((c) => c.id === v.selectedId) ?? null;
  const state = clip ? v.analyses[clip.id] : undefined;
  const analysis = state?.result ?? null;
  const marks = clip ? v.marks[clip.id] : undefined;
  const m = clipMetrics(marks, analysis, v.setup);
  const unchecked = marks ? Object.values(marks).some((x) => x.source === "auto") : false;

  // Pick the first clip when arriving with none selected.
  useEffect(() => {
    if (!v.selectedId && v.clips.length > 0) v.select(v.clips[0].id);
  }, [v]);

  if (!v.file) return <VideoDrop />;

  const playhead = v.playhead;
  const seek = (t: number) => v.seek(t);

  // Every delivery tracked in this session (nothing is stored once the page closes).
  const history = v.clips
    .filter((c) => c.id !== clip?.id)
    .map((c) => clipMetrics(v.marks[c.id], v.analyses[c.id]?.result ?? null, v.setup))
    .filter((x) => x.length != null)
    .map((x) => ({ length: x.length!, line: x.line }));
  const current = m.length != null ? [{ length: m.length, line: m.line, current: true }] : [];

  return (
    <div className="space-y-5">
      <FileBar />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3 border border-line bg-white p-3">
            <label className="min-w-[220px] flex-1">
              <span className="label">Delivery</span>
              <select
                className="field"
                value={clip?.id ?? ""}
                onChange={(e) => v.select(e.target.value || null)}
              >
                <option value="">{v.clips.length ? "Choose a clip…" : "No clips yet"}</option>
                {v.clips.map((c, k) => (
                  <option key={c.id} value={c.id}>
                    {`Clip ${String(k + 1).padStart(2, "0")} · ${clock(c.contact ?? c.start)}${c.manual ? " · manual" : ""}`}
                  </option>
                ))}
              </select>
            </label>
            <Button tone="ghost" onClick={() => v.select(v.addManualClip(playhead()).id)}>
              New clip at playhead
            </Button>
            <Button
              tone="gold"
              disabled={!clip || state?.status === "running"}
              onClick={() => clip && v.analyze(clip)}
            >
              {state?.status === "running" ? `Tracking ${Math.round(state.progress * 100)}%` : analysis ? "Track again" : "Track ball"}
            </Button>
          </div>
          {v.audio.status === "loading" ? (
            <p className="text-sm text-slate">Finding shots in the audio ({Math.round(v.audio.progress * 100)}%)… clips will appear here.</p>
          ) : null}

          <Stage
            clip={clip}
            calibrating={calibrating != null}
            onCalibrate={(x) => {
              const pts = [...(calibrating ?? []), x];
              if (pts.length === 2) {
                v.setSetup({ ...v.setup, stumps: { leftX: Math.min(pts[0], pts[1]), rightX: Math.max(pts[0], pts[1]) } });
                setCalibrating(null);
              } else setCalibrating(pts);
            }}
          />

          {state?.status === "error" ? (
            <p role="alert" className="border-l-4 border-risk bg-risk/5 px-3 py-2 text-sm text-risk">{state.error}</p>
          ) : null}
          {state?.status === "running" ? <Meter value={state.progress} max={1} tone="gold" /> : null}

          <div className="grid gap-px bg-line sm:grid-cols-3">
            <Stat
              tone="dark"
              label="Speed"
              value={fmt.num(m.speed)}
              unit="km/h"
              note={m.speed != null ? (unchecked ? "Uses auto marks: check them below" : "Average, release to contact") : "Needs release and contact"}
            />
            <Stat
              label="Length"
              value={fmt.num(m.length, 1)}
              unit="m"
              note={m.length != null ? `${lengthZone(m.length)} · from the batter's stumps` : "Needs a bounce too"}
            />
            <Stat
              label="Line"
              value={m.line != null ? `${Math.abs(m.line).toFixed(0)}` : "—"}
              unit={m.line != null ? `cm ${m.line < 0 ? "left" : "right"}` : "cm"}
              note={v.setup.stumps ? "Of middle stump, camera view" : "Mark the stumps to estimate"}
            />
          </div>

          <Panel title="Timing marks">
            {!clip ? (
              <Empty title="Choose a delivery">Pick a clip above, or scrub to a delivery and add a clip at the playhead.</Empty>
            ) : (
              <>
                {analysis?.releaseNote ? (
                  <p className="mb-3 border-l-4 border-warn bg-warn/5 px-3 py-2 text-sm text-warn">{analysis.releaseNote}</p>
                ) : null}
                {analysis && analysis.points.length > 0 ? (
                  <p className="mb-3 text-sm text-slate">
                    Ball tracked in {analysis.points.length} frames at about {Math.round(analysis.fps)} fps.
                    {analysis.fps < 50 ? " Faster frame rates (60–240 fps) give sharper timings." : ""}
                  </p>
                ) : null}
                <div className="divide-y divide-line">
                  {MARKS.map(({ key, label, help }) => {
                    const mk = marks?.[key];
                    return (
                      <div key={key} className="flex flex-wrap items-center gap-3 py-2.5">
                        <div className="w-28">
                          <p className="font-display text-lg font-bold uppercase text-navy">{label}</p>
                          {mk?.source ? <Tag tone={mk.source === "auto" ? "navy" : "gold"}>{mk.source}</Tag> : <Tag tone="mute">not set</Tag>}
                        </div>
                        <p className="w-24 font-display text-xl font-bold tabular-nums">{mk?.t != null ? `${mk.t.toFixed(3)}s` : "—"}</p>
                        <p className="min-w-[160px] flex-1 text-xs text-slate">{help}</p>
                        <div className="flex gap-1.5">
                          <Button size="sm" tone="ghost" onClick={() => v.setMark(clip.id, key, playhead())}>Set to playhead</Button>
                          <Button size="sm" tone="ghost" disabled={mk?.t == null} onClick={() => mk?.t != null && seek(mk.t)}>Go</Button>
                          <Button size="sm" tone="ghost" disabled={mk?.t == null} onClick={() => v.setMark(clip.id, key, null)}>Clear</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Pitch map">
            <div className="flex justify-center">
              <PitchMap points={[...history, ...current]} />
            </div>
            <p className="mt-3 text-xs text-slate">
              Red: this delivery. Navy: other deliveries tracked in this video. Hollow dots have no line estimate.
            </p>
          </Panel>
          <Panel title="Camera setup">
            <label className="block">
              <span className="label">Release to contact distance</span>
              <select
                className="field"
                value={
                  Math.abs(v.setup.distanceM - CREASE_TO_CREASE_M) < 0.01
                    ? "crease"
                    : Math.abs(v.setup.distanceM - PITCH_M) < 0.01
                      ? "stumps"
                      : "custom"
                }
                onChange={(e) =>
                  v.setSetup({
                    ...v.setup,
                    distanceM: e.target.value === "crease" ? CREASE_TO_CREASE_M : e.target.value === "stumps" ? PITCH_M : v.setup.distanceM + 0.001,
                  })
                }
              >
                <option value="crease">Bowler, crease to crease ({CREASE_TO_CREASE_M.toFixed(2)} m)</option>
                <option value="stumps">Stumps to stumps ({PITCH_M.toFixed(2)} m)</option>
                <option value="custom">Custom (bowling machine, short nets)</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="label">Distance in metres</span>
              <input
                className="field"
                type="number"
                min={5}
                max={25}
                step={0.01}
                value={Number(v.setup.distanceM.toFixed(2))}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 5 && n <= 25) v.setSetup({ ...v.setup, distanceM: n });
                }}
              />
            </label>
            <label className="mt-3 block">
              <span className="label">Camera behind the bowler&apos;s stumps (m)</span>
              <input
                className="field"
                type="number"
                min={0}
                max={15}
                step={0.5}
                value={v.setup.cameraBehindM}
                onChange={(e) => v.setSetup({ ...v.setup, cameraBehindM: Math.max(0, Number(e.target.value)) })}
              />
            </label>
            <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
              <div>
                <p className="label mb-0">Stumps</p>
                <p className="text-sm">{v.setup.stumps ? "Marked" : "Not marked"}</p>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" tone={calibrating ? "gold" : "ghost"} onClick={() => setCalibrating(calibrating ? null : [])}>
                  {calibrating ? "Cancel" : "Mark stumps"}
                </Button>
                {v.setup.stumps ? (
                  <Button size="sm" tone="ghost" onClick={() => v.setSetup({ ...v.setup, stumps: null })}>Clear</Button>
                ) : null}
              </div>
            </div>
          </Panel>
          <Panel title="How the numbers work">
            <ul className="space-y-2 text-sm text-slate">
              <li><b className="text-ink">Speed</b> is the distance above divided by the time from release to bat contact: an average over the flight, so a little below release speed.</li>
              <li><b className="text-ink">Length</b> assumes the ball keeps that speed until it bounces.</li>
              <li><b className="text-ink">Line</b> needs a camera directly behind the stumps and the stumps marked.</li>
              <li>Check every auto mark with the frame buttons. One frame at 30 fps is 33 ms, about 5% of the speed.</li>
            </ul>
          </Panel>
        </aside>
      </div>

    </div>
  );
}
