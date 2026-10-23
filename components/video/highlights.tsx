"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  canSaveToPhotos,
  download,
  estimateBytes,
  exportClip,
  exportReel,
  isApple,
  isOutOfMemory,
  isTouchDevice,
  MAX_PARTS,
  reelBudget,
  saveToPhotos,
} from "@/lib/video/ffmpeg";
import { Button, Empty, Meter, Panel, Stat, Tag } from "../ui";
import { Stage } from "./stage";
import { FileBar, VideoDrop, clock } from "./video-drop";
import { PRESETS, useVideo, type Clip, type PresetKey } from "./video-context";

/** One part of the highlights: clips [from, to) of the ticked clips. */
type Reel = { url: string; blob: Blob; clips: number; seconds: number; part: number; from: number; to: number };
type Ready = { blob: Blob; name: string; label: string };

/** Splits the clips, in order, into groups that each make a video small enough for this device. */
function splitForMemory(clips: Clip[], bytes: (c: Clip) => number, budget: number): Clip[][] {
  const groups: Clip[][] = [];
  let size = Infinity;
  for (const c of clips) {
    const b = bytes(c);
    if (size + b > budget) {
      groups.push([]);
      size = 0;
    }
    groups[groups.length - 1].push(c);
    size += b;
  }
  return groups;
}

export function Highlights() {
  const v = useVideo();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reelProgress, setReelProgress] = useState(0);
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [precise, setPrecise] = useState(false);
  const [reel, setReel] = useState<Reel | null>(null);
  // Shrinks the parts after a part runs out of memory anyway, for the rest of this video.
  const [scale, setScale] = useState(1);
  const [savedPart, setSavedPart] = useState<number | null>(null);
  const [touch] = useState(isTouchDevice);
  const [bigParts, setBigParts] = useState(() => {
    try {
      return localStorage.getItem("flipper.bigParts") === "1";
    } catch {
      return false;
    }
  });
  function chooseBigParts(on: boolean) {
    setBigParts(on);
    setScale(1);
    try {
      localStorage.setItem("flipper.bigParts", on ? "1" : "0");
    } catch {}
  }
  // Which part is being made, and when it started, for the progress line.
  const [building, setBuilding] = useState<{ part: number; of: number; clips: number } | null>(null);
  const startedAt = useRef(0);
  // A single clip made on a phone, waiting for a tap to save it (the share sheet needs a fresh tap).
  const [ready, setReady] = useState<Ready | null>(null);
  const [shareable] = useState(canSaveToPhotos);
  const photosLabel = isApple() ? "Save to Photos" : "Save to gallery";

  // Free the previous highlights video's memory when it is replaced or the page closes.
  useEffect(() => () => {
    if (reel) URL.revokeObjectURL(reel.url);
  }, [reel]);

  // A new or removed video starts over: nothing made from the old one is kept.
  const [forFile, setForFile] = useState(v.file);
  if (forFile !== v.file) {
    setForFile(v.file);
    setReel(null);
    setReady(null);
    setSkip(new Set());
    setError(null);
    setScale(1);
  }

  if (!v.file) return <VideoDrop />;

  const selected = v.clips.find((c) => c.id === v.selectedId) ?? null;
  const included = v.clips.filter((c) => !skip.has(c.id));
  const total = included.reduce((a, c) => a + (c.end - c.start), 0);
  const base = v.file.name.replace(/\.[^.]+$/, "");
  const fileSize = v.file.size;
  // If the browser can't tell the video's length, the last clip is close to the end of the session.
  const lastEnd = v.clips.reduce((a, c) => Math.max(a, c.end), 0);
  const duration = v.meta?.duration && Number.isFinite(v.meta.duration) ? v.meta.duration : lastEnd + 5;
  const bytes = (c: Clip) => estimateBytes(fileSize, duration, c.end - c.start, 1, precise);
  const estimate = included.reduce((a, c) => a + bytes(c), 0);
  const budget = reelBudget(estimate, bigParts);
  const groups = splitForMemory(included, bytes, budget * scale);
  const seconds = (g: Clip[]) => g.reduce((a, c) => a + (c.end - c.start), 0);
  // Parts left after the current one, at the current part size.
  const remaining = reel ? splitForMemory(included.slice(reel.to), bytes, budget * scale).length : 0;
  const totalParts = reel ? reel.part + 1 + remaining : groups.length;
  const reelName = (part: number) => (totalParts > 1 ? `${base}_highlights_part${part + 1}.mp4` : `${base}_highlights.mp4`);

  function toggle(id: string) {
    setSkip((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /**
   * Makes the part that starts at ticked clip `from`. If the device still runs out of memory, the
   * part is made again with half as many clips, down to a single clip, without asking.
   */
  function buildReel(from = 0, part = 0) {
    if (from >= included.length) return;
    // Let go of the previous part first so two are never in memory at once.
    setReel(null);
    void run("reel", async () => {
      let s = scale;
      for (;;) {
        const group = splitForMemory(included.slice(from), bytes, budget * s)[0];
        setBuilding({ part, of: part + splitForMemory(included.slice(from), bytes, budget * s).length, clips: group.length });
        startedAt.current = performance.now();
        setReelProgress(0);
        try {
          const blob = await exportReel(v.file!, group, setReelProgress, { precise });
          setReel({
            url: URL.createObjectURL(blob),
            blob,
            clips: group.length,
            seconds: seconds(group),
            part,
            from,
            to: from + group.length,
          });
          return;
        } catch (err) {
          if (!isOutOfMemory(err) || group.length === 1) throw err;
          s /= 2;
          setScale(s);
        }
      }
    }).finally(() => setBuilding(null));
  }

  function nextPart(r: Reel) {
    if (r.to < included.length) buildReel(r.to, r.part + 1);
  }

  /** Saving a part starts the next one, so a long session needs one tap per part. */
  function savePart(r: Reel, how: "photos" | "download") {
    const name = reelName(r.part);
    if (how === "download") {
      download(r.blob, name);
      setSavedPart(r.part);
      // Give the browser a moment to start the download before the next part takes the memory.
      setTimeout(() => nextPart(r), 1500);
      return;
    }
    void (async () => {
      let shared = false;
      await run("share", async () => {
        shared = await saveToPhotos(r.blob, name);
      });
      if (shared) {
        setSavedPart(r.part);
        nextPart(r);
      }
    })();
  }

  function save(blob: Blob, name: string) {
    void run("share", async () => {
      await saveToPhotos(blob, name);
    });
  }

  function play(c: Clip) {
    v.select(c.id);
    v.seek(c.start, true);
  }

  function timeLeft(): string {
    const elapsed = (performance.now() - startedAt.current) / 1000;
    if (reelProgress < 0.08 || elapsed < 4) return "working out time left";
    const left = (elapsed * (1 - reelProgress)) / reelProgress;
    return left < 60 ? "under a minute left" : `about ${Math.round(left / 60)} min left`;
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
        <Stat
          label="Detection"
          value={PRESETS[v.settings.preset].label}
          note={v.motion.status === "done" ? "Bat sounds and bowling actions" : "From bat sounds"}
        />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Stage clip={selected} />
          {v.clips.length > 0 ? (
            <Panel title="Highlights video">
              {reel ? (
                <div className="grid gap-4 md:grid-cols-[minmax(0,240px)_1fr]">
                  <video src={reel.url} controls playsInline className="w-full bg-navy-950" />
                  <div className="space-y-3">
                    <p className="display text-2xl font-extrabold text-navy">
                      {totalParts > 1 ? `Part ${reel.part + 1} of ${totalParts} is ready` : "Your highlights are ready"}
                    </p>
                    <p className="text-sm text-slate">
                      {reel.clips} clips · about {clock(reel.seconds)} · {(reel.blob.size / 1_048_576).toFixed(1)} MB.
                      {reel.to < included.length
                        ? " Save it and the next part starts straight away."
                        : totalParts > 1
                          ? " That's the last part."
                          : " Watch it here, then save it."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {shareable ? (
                        <Button tone="gold" disabled={busy === "share"} onClick={() => savePart(reel, "photos")}>
                          {photosLabel}
                        </Button>
                      ) : null}
                      <Button tone={shareable ? "ghost" : "gold"} onClick={() => savePart(reel, "download")}>
                        Download video
                      </Button>
                      {reel.to < included.length ? (
                        <Button tone={savedPart === reel.part ? "gold" : "ghost"} disabled={busy != null} onClick={() => nextPart(reel)}>
                          Make part {reel.part + 2}
                        </Button>
                      ) : null}
                      <Button tone="ghost" onClick={() => setReel(null)}>
                        Start over
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
                    <p className="mt-2 border-l-4 border-gold bg-gold/10 px-3 py-2 text-sm text-ink">
                      {groups.length > MAX_PARTS ? (
                        <>
                          At about {Math.round(estimate / 1_048_576)} MB this would take <b>{groups.length} parts</b> on this
                          device, more than the {MAX_PARTS} it can do. {touch && !bigParts ? "Turn on Bigger parts below, untick" : "Untick"}{" "}
                          clips you don&apos;t need (or pick <b>Big hits</b>), or make it on a computer.
                        </>
                      ) : groups.length > 1 ? (
                        <>
                          At about {Math.round(estimate / 1_048_576)} MB this comes in <b>{groups.length} parts</b> of up to{" "}
                          {Math.round((budget * scale) / 1e6)} MB, so your device never runs out of memory. Save each part and
                          the next one starts by itself.
                        </>
                      ) : (
                        <>About {Math.round(estimate / 1_048_576)} MB: small enough to make in one go.</>
                      )}
                    </p>
                    {touch ? (
                      <label className="mt-2 flex items-start gap-2 text-sm">
                        <input type="checkbox" className="mt-1" checked={bigParts} onChange={(e) => chooseBigParts(e.target.checked)} />
                        <span>
                          <b>Bigger parts</b>: up to 750 MB each, like on a computer, so fewer files. Works on most recent
                          phones. If the page reloads while making a part, turn this off.
                        </span>
                      </label>
                    ) : null}
                    {precise && included.length > 20 ? (
                      <p className="mt-2 text-sm text-warn">
                        Exact cuts re-encode every clip on this device, which can take several minutes for {included.length} clips.
                        Untick it for a much faster video.
                      </p>
                    ) : null}
                    <label className="mt-2 flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" checked={precise} onChange={(e) => setPrecise(e.target.checked)} />
                      <span>
                        <b>Exact cuts</b>: every clip starts on the exact frame, and the file is smaller. Slower (re-encodes,
                        1080p max). Without it, clips can start up to a second early, but it takes seconds.
                      </span>
                    </label>
                  </div>
                  <Button
                    tone="gold"
                    disabled={busy != null || included.length === 0 || groups.length > MAX_PARTS}
                    onClick={() => buildReel(0, 0)}
                  >
                    {busy === "reel"
                      ? building && building.of > 1
                        ? `Part ${building.part + 1} of ${building.of} · ${Math.round(reelProgress * 100)}%`
                        : `Building ${Math.round(reelProgress * 100)}%`
                      : groups.length > 1
                        ? `Create part 1 of ${groups.length}`
                        : "Create highlights video"}
                  </Button>
                </div>
              )}
              {busy === "reel" ? (
                <div className="mt-3 space-y-1.5">
                  <p className="text-sm text-slate">
                    {building && building.of > 1 ? `Making part ${building.part + 1} of ${building.of}` : "Making your highlights video"}
                    {" · "}
                    {building && reelProgress >= building.clips / (building.clips + 1) - 1e-6
                      ? "joining the clips"
                      : `cutting clip ${Math.min(building?.clips ?? 1, Math.floor(reelProgress * ((building?.clips ?? 0) + 1)) + 1)} of ${building?.clips ?? "?"}`} · {timeLeft()}. Keep this tab open.
                  </p>
                  <Meter value={reelProgress} max={1} tone="gold" />
                </div>
              ) : null}
              {error ? <p className="mt-3 border-l-4 border-risk bg-risk/5 px-3 py-2 text-sm text-risk">{error}</p> : null}
            </Panel>
          ) : null}
          {ready ? (
            <div className="flex flex-wrap items-center gap-3 border-l-4 border-gold bg-white p-4 shadow-sm">
              <p className="min-w-[160px] flex-1 font-display text-lg font-bold text-navy">{ready.label} is ready</p>
              <Button tone="gold" size="sm" disabled={busy === "share"} onClick={() => save(ready.blob, ready.name)}>
                {photosLabel}
              </Button>
              <Button tone="ghost" size="sm" onClick={() => download(ready.blob, ready.name)}>
                Download
              </Button>
              <button aria-label="Close" onClick={() => setReady(null)} className="px-2 text-lg leading-none text-mute hover:text-navy">
                ×
              </button>
            </div>
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
                  <Empty title="No shots detected">
                    Try <b>Everything</b>, scan for balls with no bat sound, or add clips by hand from the playhead.
                  </Empty>
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
                      <th className="px-2 py-2 font-bold">Found by</th>
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
                          <td className="px-2 py-2 tabular-nums">{c.contact != null ? clock(c.contact) : "—"}</td>
                          <td className="w-36 px-2 py-2">
                            {c.kind === "bat" ? (
                              <span className="flex items-center gap-2" title={`${Math.round(c.level ?? 0)} dB against your big hits`}>
                                <Tag>Bat</Tag>
                                <span className="w-14"><Meter value={Math.max(0, (c.level ?? -40) + 40)} max={40} tone="gold" /></span>
                              </span>
                            ) : c.kind === "no-sound" ? (
                              <Tag tone="gold">No bat sound</Tag>
                            ) : (
                              <Tag tone="mute">Manual</Tag>
                            )}
                          </td>
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
                                  run(`clip-${c.id}`, async () => {
                                    const blob = await exportClip(v.file!, c.start, c.end - c.start);
                                    const name = `${base}_clip${k + 1}.mp4`;
                                    if (shareable) setReady({ blob, name, label: `Clip ${k + 1}` });
                                    else download(blob, name);
                                  })
                                }
                              >
                                {busy === `clip-${c.id}` ? "…" : "Save"}
                              </Button>
                              <Button size="sm" tone="danger" onClick={() => v.removeClip(c.id)} title="Remove this clip">
                                Not a shot
                              </Button>
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
                      v.setSettings({ ...v.settings, preset: k, threshold: k === "custom" ? v.settings.threshold : PRESETS[k].threshold })
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
              <Slider label="Quietest shot" value={v.settings.threshold} min={-40} max={-5} step={1} format={(n) => `${n} dB`}
                onChange={(n) => v.setSettings({ ...v.settings, threshold: n })} />
            ) : null}
            <Slider label="Lead-in" value={v.settings.leadIn} min={0.5} max={4} step={0.1} format={(n) => `${n.toFixed(1)} s`}
              onChange={(n) => v.setSettings({ ...v.settings, leadIn: n })} />
            <Slider label="Clip length" value={v.settings.length} min={1} max={15} step={0.5} format={(n) => `${n.toFixed(1)} s`}
              onChange={(n) => v.setSettings({ ...v.settings, length: n })} />
            <p className="mt-4 text-xs text-mute">
              Every ball gets its own clip, however close together. Clips stop short of the next shot.
            </p>
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={v.settings.batOnly} onChange={(e) => v.setSettings({ ...v.settings, batOnly: e.target.checked })} />
              <span>
                <b>Bat only</b>: keep a bat sound only if the bowler bowled just before it. Drops talking, throws and
                other nets.
              </span>
            </label>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={v.settings.addSilent} onChange={(e) => {
                  v.setSettings({ ...v.settings, addSilent: e.target.checked });
                  // Finding balls with no bat sound needs the whole video watched, not just before each sound.
                  if (e.target.checked) v.scanWholeVideo();
                }} />
              <span>
                <b>Add balls with no bat sound</b>: misses, leaves and bowled. Watches the whole video, so it takes longer.
              </span>
            </label>
          </Panel>
          <SilentBalls />
          <Panel title="Saving videos">
            <p className="text-sm text-slate">
              <b className="text-ink">Save</b> on a clip saves just that clip. <b className="text-ink">Create highlights
              video</b> joins the ticked clips into one. Everything is made on this device; nothing is uploaded.
            </p>
            <p className="mt-3 text-sm text-slate">
              Your video stays only in this tab&apos;s memory. It and anything made from it are wiped when you press
              Change video, sign out or close the tab.
            </p>
            {shareable ? (
              <p className="mt-3 text-sm text-slate">
                {isApple() ? (
                  <>
                    <b className="text-ink">Save to Photos</b> opens the share sheet: tap <b className="text-ink">Save Video</b>{" "}
                    and it goes straight into your camera roll.
                  </>
                ) : (
                  <>
                    <b className="text-ink">Save to gallery</b> opens the share sheet: pick your gallery or Google Photos.
                  </>
                )}
              </p>
            ) : null}
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

/** The optional bowling-action scan: finds misses, leaves and bowled balls that made no bat sound. */
/** Status of the bowling scan, which runs by itself after the sound is read. */
function SilentBalls() {
  const { motion, scanForSilentBalls, clips, settings, meta } = useVideo();
  const silent = clips.filter((c) => c.kind === "no-sound").length;
  const seenSec = (motion.covered ?? []).reduce((a, [x, y]) => a + (y - x), 0);
  // Against what the scan was asked to watch: the stretches before each bat sound, or the whole video.
  const planned = motion.planned ?? meta?.duration ?? 0;
  const seen = planned ? Math.min(1, seenSec / planned) : 1;
  return (
    <Panel title="Bowler check">
      <p className="text-sm text-slate">
        Flipper also watches for the bowler&apos;s action, so a clip is only made when someone actually bowled.
      </p>
      {motion.status === "running" ? (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-slate">
            Watching for bowling actions… {Math.round(motion.progress * 100)}%. Until it finishes, every bat sound is shown.
          </p>
          {motion.detail ? <p className="text-xs text-mute">{motion.detail}…</p> : null}
          {motion.slow ? (
            <p className="text-sm text-warn">
              Slow mode: this browser wouldn&apos;t play the video in the background, so Flipper is reading it frame by
              frame. It will finish, just slowly. Next time, turn off Low Power Mode and keep this page on screen.
            </p>
          ) : null}
          <Meter value={motion.progress} max={1} />
        </div>
      ) : motion.status === "done" && seen < 0.8 ? (
        <>
          <p className="mt-3 text-sm text-warn">
            The browser only showed part of what it needed to check ({Math.round(seen * 100)}%), usually because Flipper wasn&apos;t on
            screen. Bat sounds in the parts it couldn&apos;t see are all kept. Keep this page open and on screen, then:
          </p>
          <Button className="mt-2" size="sm" tone="navy" onClick={scanForSilentBalls}>Check again</Button>
        </>
      ) : motion.status === "done" ? (
        <p className="mt-3 text-sm text-ink">
          Done. {settings.batOnly ? "Only bat sounds after a bowling action are kept." : "Bat only is off: every bat sound is kept."}
          {settings.addSilent ? ` ${silent} ${silent === 1 ? "ball" : "balls"} with no bat sound added.` : ""}
        </p>
      ) : motion.status === "error" && motion.needsTap ? (
        <>
          <p className="mt-3 text-sm text-warn">{motion.error} Until it runs, every bat sound is shown.</p>
          <Button className="mt-2" tone="gold" onClick={scanForSilentBalls}>Start the check</Button>
        </>
      ) : motion.status === "error" ? (
        <>
          <p className="mt-3 text-sm text-risk">{motion.error} Every bat sound is shown instead.</p>
          <Button className="mt-2" size="sm" tone="navy" onClick={scanForSilentBalls}>Try again</Button>
        </>
      ) : (
        <p className="mt-3 text-sm text-mute">Starts once the sound has been read.</p>
      )}
    </Panel>
  );
}
