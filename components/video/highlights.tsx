"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { download, exportClip, exportReel } from "@/lib/video/ffmpeg";
import { Button, Empty, Meter, Panel, Stat, Tag } from "../ui";
import { Stage } from "./stage";
import { FileBar, VideoDrop, clock } from "./video-drop";
import { PRESETS, useVideo, type Clip, type PresetKey } from "./video-context";

type Reel = { url: string; blob: Blob; clips: number; seconds: number };

export function Highlights() {
  const v = useVideo();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reelProgress, setReelProgress] = useState(0);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [precise, setPrecise] = useState(false);
  const [reel, setReel] = useState<Reel | null>(null);

  // Free the previous highlights video's memory when it is replaced or the page closes.
  useEffect(() => () => {
    if (reel) URL.revokeObjectURL(reel.url);
  }, [reel]);

  if (!v.file) return <VideoDrop />;

  const selected = v.clips.find((c) => c.id === v.selectedId) ?? null;
  const included = v.clips.filter((c) => !skip.has(c.id));
  const total = included.reduce((a, c) => a + (c.end - c.start), 0);
  const base = v.file.name.replace(/\.[^.]+$/, "");

  function toggle(id: string) {
    setSkip((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function buildReel() {
    void run("reel", async () => {
      setReelProgress(0);
      const blob = await exportReel(v.file!, included, setReelProgress, { precise });
      setReel({ url: URL.createObjectURL(blob), blob, clips: included.length, seconds: total });
    });
  }

  function play(c: Clip) {
    v.select(c.id);
    v.seek(c.start, true);
  }

  async function run(label: string, job: () => Promise<void>) {
    setBusy(label);
    setError(null);
    try {
      await job();
    } catch (err) {
      setError((err as Error).message || "Export failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <FileBar />
      <div className="grid gap-px bg-line sm:grid-cols-3">
        <Stat label="Clips found" value={v.clips.length} note={`${included.length} in the highlights video`} />
        <Stat label="Highlights length" value={clock(total)} />
        <Stat label="Detection" value={PRESETS[v.settings.preset].label} note={`Loudness above ${v.settings.sensitivity.toFixed(2)}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Stage clip={selected} />
          {v.clips.length > 0 ? (
            <Panel title="Highlights video">
              {reel ? (
                <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_1fr]">
                  <video src={reel.url} controls playsInline className="w-full bg-navy-950" />
                  <div className="space-y-3">
                    <p className="display text-2xl font-extrabold text-navy">Your highlights are ready</p>
                    <p className="text-sm text-slate">
                      {reel.clips} clips · about {clock(reel.seconds)} · {(reel.blob.size / 1_048_576).toFixed(1)} MB. Watch it
                      here, then save it.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button tone="gold" onClick={() => download(reel.blob, `${base}_highlights.mp4`)}>
                        Download video
                      </Button>
                      <Button tone="ghost" onClick={() => setReel(null)}>
                        Make another
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[200px] flex-1">
                    <p className="text-sm text-slate">
                      Joins the <b className="text-ink">{included.length}</b> ticked clips below, in order, into one video (
                      {clock(total)}). Untick any you don&apos;t want.
                    </p>
                    <label className="mt-2 flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={precise} onChange={(e) => setPrecise(e.target.checked)} />
                      <span>
                        <b>Exact cuts</b>: every clip starts on the exact frame. Slower (re-encodes, 1080p max). Without it,
                        clips can start up to a second early, but it takes seconds.
                      </span>
                    </label>
                  </div>
                  <Button tone="gold" disabled={busy != null || included.length === 0} onClick={buildReel}>
                    {busy === "reel" ? `Building ${Math.round(reelProgress * 100)}%` : "Create highlights video"}
                  </Button>
                </div>
              )}
              {busy === "reel" ? (
                <div className="mt-3">
                  <Meter value={reelProgress} max={1} tone="gold" />
                </div>
              ) : null}
              {error ? <p className="mt-3 border-l-4 border-risk bg-risk/5 px-3 py-2 text-sm text-risk">{error}</p> : null}
            </Panel>
          ) : null}
          <Panel
            title="Clips"
            flush
            action={
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  v.select(v.addManualClip(v.playhead()).id);
                }}
              >
                Add clip at playhead
              </Button>
            }
          >
            <AudioNotice />
            {v.clips.length === 0 ? (
              v.audio.status === "ready" ? (
                <div className="p-4">
                  <Empty title="No shots detected">Lower the sensitivity, or add clips by hand from the playhead.</Empty>
                </div>
              ) : null
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-navy text-left font-display text-[0.8rem] uppercase tracking-wider text-white">
                      <th className="w-10 px-4 py-2 font-bold">
                        <span className="sr-only">Include</span>
                      </th>
                      <th className="px-2 py-2 font-bold">#</th>
                      <th className="px-2 py-2 font-bold">Start</th>
                      <th className="px-2 py-2 font-bold">Contact</th>
                      <th className="px-2 py-2 font-bold">Loudness</th>
                      <th className="px-4 py-2 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.clips.map((c, k) => {
                      const active = c.id === v.selectedId;
                      return (
                        <tr
                          key={c.id}
                          className={`border-b border-line ${active ? "bg-gold/15" : k % 2 ? "bg-paper/60" : ""} ${skip.has(c.id) ? "text-mute" : ""}`}
                        >
                          <td className="px-4 py-2">
                            <input
                              type="checkbox"
                              checked={!skip.has(c.id)}
                              onChange={() => toggle(c.id)}
                              aria-label={`Include clip ${k + 1} in the highlights video`}
                            />
                          </td>
                          <td className="px-2 py-2 font-display font-bold text-navy">{String(k + 1).padStart(2, "0")}</td>
                          <td className="px-2 py-2 tabular-nums">{clock(c.start)}</td>
                          <td className="px-2 py-2 tabular-nums">{c.contact != null ? clock(c.contact) : <Tag tone="mute">Manual</Tag>}</td>
                          <td className="w-32 px-2 py-2">{c.level != null ? <Meter value={c.level} max={0.6} tone="gold" /> : "—"}</td>
                          <td className="px-4 py-2">
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" tone="ghost" onClick={() => play(c)}>Play</Button>
                              <Button
                                size="sm"
                                tone="ghost"
                                onClick={() => {
                                  v.select(c.id);
                                  router.push("/tracking");
                                }}
                              >
                                Track
                              </Button>
                              <Button
                                size="sm"
                                tone="ghost"
                                disabled={busy != null}
                                onClick={() =>
                                  run(`clip-${c.id}`, async () =>
                                    download(await exportClip(v.file!, c.start, c.end - c.start), `${base}_clip${k + 1}.mp4`),
                                  )
                                }
                              >
                                {busy === `clip-${c.id}` ? "…" : "Save"}
                              </Button>
                              <button
                                aria-label="Remove clip"
                                title="Remove clip"
                                onClick={() => v.removeClip(c.id)}
                                className="px-2 text-lg leading-none text-mute hover:text-risk"
                              >
                                ×
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Detection">
            <fieldset>
              <legend className="label">Preset</legend>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() =>
                      v.setSettings({ ...v.settings, preset: k, sensitivity: k === "custom" ? v.settings.sensitivity : PRESETS[k].sensitivity })
                    }
                    className={`border px-2 py-2 text-left text-xs ${
                      v.settings.preset === k ? "border-navy bg-navy text-white" : "border-line bg-white text-ink hover:border-navy"
                    }`}
                  >
                    <span className="block font-display text-sm font-bold uppercase tracking-wide">{PRESETS[k].label}</span>
                    <span className={v.settings.preset === k ? "text-white/70" : "text-mute"}>{PRESETS[k].note}</span>
                  </button>
                ))}
              </div>
            </fieldset>
            {v.settings.preset === "custom" ? (
              <Slider label="Sensitivity" value={v.settings.sensitivity} min={0.05} max={0.4} step={0.01} format={(n) => n.toFixed(2)}
                onChange={(n) => v.setSettings({ ...v.settings, sensitivity: n })} />
            ) : null}
            <Slider label="Lead-in" value={v.settings.leadIn} min={0.5} max={4} step={0.1} format={(n) => `${n.toFixed(1)} s`}
              onChange={(n) => v.setSettings({ ...v.settings, leadIn: n })} />
            <Slider label="Clip length" value={v.settings.length} min={1} max={15} step={0.5} format={(n) => `${n.toFixed(1)} s`}
              onChange={(n) => v.setSettings({ ...v.settings, length: n })} />
            <Slider label="Gap between shots" value={v.settings.minGap} min={1} max={10} step={0.5} format={(n) => `${n.toFixed(1)} s`}
              onChange={(n) => v.setSettings({ ...v.settings, minGap: n })} />
          </Panel>
          <Panel title="Saving videos">
            <p className="text-sm text-slate">
              <b className="text-ink">Save</b> on a clip downloads just that clip. <b className="text-ink">Create highlights
              video</b> joins the ticked clips into one. Everything is made on this device; nothing is uploaded.
            </p>
            <p className="mt-3 text-xs text-mute">The first time, the video engine (about 30 MB) downloads once.</p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function AudioNotice() {
  const { audio } = useVideo();
  if (audio.status === "loading") {
    return (
      <div className="space-y-2 border-b border-line p-4">
        <p className="text-sm text-slate">Listening for bat-on-ball contact… {Math.round(audio.progress * 100)}%</p>
        <Meter value={audio.progress} max={1} />
      </div>
    );
  }
  if (audio.status === "none" || audio.status === "error") {
    return (
      <p className="border-b border-line bg-warn/5 p-4 text-sm text-warn">
        {audio.status === "none"
          ? "This video has no sound, so shots can't be found automatically. Add clips at the playhead instead."
          : `Audio scan failed: ${audio.error}. You can still add clips by hand.`}
      </p>
    );
  }
  return null;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="mt-4 block">
      <span className="flex justify-between text-sm">
        <span className="label mb-0">{label}</span>
        <span className="font-display font-bold tabular-nums text-navy">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[#00175f]"
      />
    </label>
  );
}
