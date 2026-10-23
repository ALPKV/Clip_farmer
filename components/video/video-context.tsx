"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { analyzeFrames, type BallAnalysis } from "@/lib/tracking/analyze";
import {
  clipWindows,
  combineDeliveries,
  coveredLength,
  coveredSpans,
  deliveryId,
  motionPeaks,
  type MotionPeak,
} from "@/lib/tracking/deliveries";
import { findImpacts, groupDeliveries, refineContact, type SoundDelivery } from "@/lib/tracking/hits";
import { DEFAULT_SETUP, lengthM, lineCm, speedKmh, type Setup } from "@/lib/tracking/metrics";
import { extractAudio, releaseEngine } from "@/lib/video/ffmpeg";
import { captureFrames } from "@/lib/video/frames";
import { scanMotion } from "@/lib/video/motion";

/**
 * The loaded video and everything derived from it, shared by the Highlights and Ball Tracking
 * tabs so switching tabs keeps your work. Nothing here leaves the browser, and all of it is dropped
 * (and the video engine shut down) when the video is removed, you sign out or the tab closes.
 */

/** How quiet a bat sound can be, in dB below the session's big hits, and still count as a shot. */
export const PRESETS = {
  big: { label: "Big hits", threshold: -10, note: "Only the loudest shots" },
  every: { label: "Every shot", threshold: -25, note: "All bat sounds, soft ones too" },
  everything: { label: "Everything", threshold: -32, note: "Edges and faint clicks; a few extras" },
  custom: { label: "Custom", threshold: -25, note: "Set your own threshold" },
} as const;
export type PresetKey = keyof typeof PRESETS;

export type ClipSettings = {
  preset: PresetKey;
  threshold: number;
  leadIn: number;
  length: number;
  /** Keep a bat sound only when the bowler bowled just before it (needs the bowling scan). */
  batOnly: boolean;
  /** Also add balls the bowler bowled that made no bat sound. */
  addSilent: boolean;
};

export type Clip = {
  id: string;
  start: number;
  end: number;
  /** Bat (or stumps) contact from the sound; null for balls with no bat sound and manual clips. */
  contact: number | null;
  /** Sound strength against the session's big hits, in dB. */
  level: number | null;
  kind: "bat" | "no-sound" | "manual";
  manual: boolean;
};

export type MarkKey = "release" | "bounce" | "contact";
export type Marks = Record<MarkKey, { t: number | null; source: "auto" | "manual" | null }>;

export type AnalysisState = {
  status: "idle" | "running" | "done" | "error";
  progress: number;
  result: BallAnalysis | null;
  error: string | null;
};

export type TrackingSetup = Setup & { stumps: { leftX: number; rightX: number } | null };

type AudioState = { status: "idle" | "loading" | "ready" | "error" | "none"; progress: number; error: string | null };
type MotionState = {
  status: "idle" | "running" | "done" | "error";
  progress: number;
  error: string | null;
  peaks: MotionPeak[] | null;
  /** Using the slow frame-by-frame method because the browser wouldn't play the video. */
  slow?: boolean;
  /** Watched the whole video (needed for balls with no bat sound), not just before each bat sound. */
  full?: boolean;
  /** Seconds of video the scan was asked to watch. */
  planned?: number;
  /** Stretches of video the scan saw clearly; Bat only only drops sounds inside them. */
  covered?: [number, number][];
};

type Ctx = {
  file: File | null;
  url: string | null;
  meta: { duration: number; width: number; height: number } | null;
  loadFile: (f: File) => void;
  clearFile: () => void;
  audio: AudioState;
  /** The scan for bowling actions, which finds balls that made no bat sound. */
  motion: MotionState;
  scanForSilentBalls: () => void;
  /** Watch the whole video, for balls with no bat sound. */
  scanWholeVideo: () => void;
  settings: ClipSettings;
  setSettings: (s: ClipSettings) => void;
  clips: Clip[];
  addManualClip: (time: number) => Clip;
  removeClip: (id: string) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
  analyses: Record<string, AnalysisState>;
  analyze: (clip: Clip) => Promise<void>;
  marks: Record<string, Marks>;
  setMark: (clipId: string, key: MarkKey, t: number | null) => void;
  setup: TrackingSetup;
  setSetup: (s: TrackingSetup) => void;
  overlay: boolean;
  setOverlay: (on: boolean) => void;
  /** Shared <video> element of the visible stage, for seeking from lists. */
  playerRef: React.RefObject<HTMLVideoElement | null>;
  /** Moves the visible player to `t` seconds (and plays from there if asked). */
  seek: (t: number, play?: boolean) => void;
  /** Current playhead of the visible player, in seconds. */
  playhead: () => number;
};

const VideoCtx = createContext<Ctx | null>(null);

export function useVideo(): Ctx {
  const v = useContext(VideoCtx);
  if (!v) throw new Error("useVideo outside VideoProvider");
  return v;
}

const DEFAULT_SETTINGS: ClipSettings = { preset: "every", threshold: -25, leadIn: 1, length: 2.5, batOnly: true, addSilent: false };
const NO_MOTION: MotionState = { status: "idle", progress: 0, error: null, peaks: null };
const DEFAULT_TRACKING: TrackingSetup = { ...DEFAULT_SETUP, stumps: null };

const emptyMarks = (): Marks => ({
  release: { t: null, source: null },
  bounce: { t: null, source: null },
  contact: { t: null, source: null },
});

function loadSetup(): TrackingSetup {
  try {
    const raw = localStorage.getItem("flipper.trackingSetup");
    if (raw) return { ...DEFAULT_TRACKING, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_TRACKING;
}

export function VideoProvider({ children }: { children: React.ReactNode }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<Ctx["meta"]>(null);
  const [audio, setAudio] = useState<AudioState>({ status: "idle", progress: 0, error: null });
  const [sounds, setSounds] = useState<SoundDelivery[] | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [motion, setMotion] = useState<MotionState>(NO_MOTION);
  const [settings, setSettings] = useState<ClipSettings>(DEFAULT_SETTINGS);
  const [manual, setManual] = useState<Clip[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [selectedId, select] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({});
  const [marks, setMarks] = useState<Record<string, Marks>>({});
  const [setup, setSetupState] = useState<TrackingSetup>(DEFAULT_TRACKING);
  const [overlay, setOverlay] = useState(true);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const loadToken = useRef(0);

  useEffect(() => setSetupState(loadSetup()), []);
  useEffect(() => releaseEngine, []);

  const setSetup = useCallback((s: TrackingSetup) => {
    setSetupState(s);
    try {
      localStorage.setItem("flipper.trackingSetup", JSON.stringify(s));
    } catch {}
  }, []);

  // Ticking "Add balls with no bat sound" mid-scan asks for a whole-video scan once this one ends.
  const wantFull = useRef(false);
  // The loudness setting, for scans started from callbacks.
  const thresholdRef = useRef(DEFAULT_SETTINGS.threshold);
  useEffect(() => {
    thresholdRef.current = settings.threshold;
  }, [settings.threshold]);

  /**
   * Watches for bowling actions (see lib/video/motion.ts). Starts by itself once the sound is read.
   * Bat only needs just the 3 s before each bat sound (any loudness the slider can reach), so by
   * default only those stretches are watched; `full` watches the whole video.
   */
  const runScan = useCallback((src: string, token: number, full: boolean, snd: SoundDelivery[] | null, thresholdDb: number) => {
    // Only sounds loud enough to become clips need checking; lowering the slider later shows the new
    // ones unchecked (kept) until Check again.
    const spans = full
      ? undefined
      : (snd ?? []).filter((d) => d.rel > thresholdDb).map((d): [number, number] => [d.contact - 3.2, d.contact + 0.3]);
    const planned = spans ? coveredLength(spans) : undefined;
    setMotion({ status: "running", progress: 0, error: null, peaks: null, full, planned });
    scanMotion(
      src,
      (p, slow) => token === loadToken.current && setMotion((m) => ({ ...m, progress: p, slow })),
      () => token !== loadToken.current,
      spans,
    )
      .then((series) => {
        if (token !== loadToken.current) return;
        setMotion({ status: "done", progress: 1, error: null, peaks: motionPeaks(series), covered: coveredSpans(series), full, planned });
        if (!full && wantFull.current) {
          wantFull.current = false;
          runScan(src, token, true, snd, thresholdDb);
        }
      })
      .catch((err: Error) => {
        if (token === loadToken.current) setMotion({ status: "error", progress: 0, error: err.message, peaks: null });
      });
  }, []);

  const clearFile = useCallback(() => {
    loadToken.current++;
    setFile(null);
    setUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setMeta(null);
    setSounds(null);
    setFps(null);
    setMotion(NO_MOTION);
    setAudio({ status: "idle", progress: 0, error: null });
    setManual([]);
    setRemoved(new Set());
    setAnalyses({});
    setMarks({});
    select(null);
    releaseEngine();
  }, []);

  const loadFile = useCallback(
    (f: File) => {
      clearFile();
      const token = ++loadToken.current;
      const u = URL.createObjectURL(f);
      setFile(f);
      setUrl(u);
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = u;
      probe.onloadedmetadata = () => {
        if (token === loadToken.current) {
          setMeta({ duration: probe.duration, width: probe.videoWidth, height: probe.videoHeight });
        }
        probe.removeAttribute("src");
      };
      setAudio({ status: "loading", progress: 0, error: null });
      const progress = (p: number) => token === loadToken.current && setAudio((a) => ({ ...a, progress: p }));
      // Reading the sound is the first 60%, listening for impacts the rest. Only the list of
      // deliveries is kept; the audio itself is dropped as soon as it has been analysed.
      extractAudio(f, (p) => progress(p * 0.6))
        .then(async (res) => {
          if (token !== loadToken.current) return;
          const impacts = await findImpacts(res.pcm, res.sampleRate, (p) => progress(0.6 + p * 0.4));
          if (token !== loadToken.current) return;
          const grouped = groupDeliveries(impacts).map((d) => ({ ...d, contact: refineContact(res.pcm, res.sampleRate, d.contact) }));
          setSounds(grouped);
          setFps(res.fps);
          setAudio({ status: "ready", progress: 1, error: null });
          runScan(u, token, false, grouped, thresholdRef.current);
        })
        .catch((err: Error) => {
          if (token !== loadToken.current) return;
          setAudio({
            status: /no readable audio/.test(err.message) ? "none" : "error",
            progress: 0,
            error: err.message || "Could not read the audio.",
          });
        });
    },
    [clearFile, runScan],
  );

  /** Retry for the bowling scan if it failed; it normally starts by itself. */
  const scanForSilentBalls = useCallback(() => {
    if (url && motion.status !== "running") runScan(url, loadToken.current, !!motion.full, sounds, settings.threshold);
  }, [url, motion.status, motion.full, sounds, settings.threshold, runScan]);

  const scanWholeVideo = useCallback(() => {
    if (!url || motion.full) return;
    if (motion.status === "running") wantFull.current = true;
    else runScan(url, loadToken.current, true, sounds, settings.threshold);
  }, [url, motion.status, motion.full, sounds, settings.threshold, runScan]);

  const deliveries = useMemo(
    () =>
      sounds
        ? combineDeliveries(sounds, motion.peaks, settings.threshold, {
            batOnly: settings.batOnly,
            addSilent: settings.addSilent,
            covered: motion.covered,
          })
        : [],
    [sounds, motion.peaks, motion.covered, settings.threshold, settings.batOnly, settings.addSilent],
  );

  const clips: Clip[] = useMemo(() => {
    const duration = meta?.duration ?? Infinity;
    const kept = deliveries.filter((d) => !removed.has(deliveryId(d)));
    const auto: Clip[] = clipWindows(kept, settings.leadIn, settings.length, duration).map(({ delivery: d, start, end }) => ({
      id: deliveryId(d),
      start,
      end,
      contact: d.kind === "bat" ? d.t : null,
      level: d.rel,
      kind: d.kind,
      manual: false,
    }));
    return [...auto, ...manual].sort((a, b) => a.start - b.start);
  }, [deliveries, manual, removed, settings.leadIn, settings.length, meta]);

  const addManualClip = useCallback(
    (time: number) => {
      const duration = meta?.duration ?? time + 2;
      const start = Math.max(0, time - 1.5);
      const clip: Clip = {
        id: `m${time.toFixed(3)}`,
        start,
        end: Math.min(duration, time + 1),
        contact: null,
        level: null,
        kind: "manual",
        manual: true,
      };
      setManual((m) => (m.some((c) => c.id === clip.id) ? m : [...m, clip]));
      return clip;
    },
    [meta],
  );

  const removeClip = useCallback((id: string) => {
    setManual((m) => m.filter((c) => c.id !== id));
    setRemoved((r) => new Set(r).add(id));
  }, []);

  const setMark = useCallback((clipId: string, key: MarkKey, t: number | null) => {
    setMarks((all) => {
      const cur = all[clipId] ?? emptyMarks();
      return { ...all, [clipId]: { ...cur, [key]: { t, source: t == null ? null : "manual" } } };
    });
  }, []);

  const analyze = useCallback(
    async (clip: Clip) => {
      if (!url) return;
      const id = clip.id;
      setAnalyses((a) => ({ ...a, [id]: { status: "running", progress: 0, result: null, error: null } }));
      try {
        const duration = meta?.duration ?? clip.end;
        const anchor = clip.contact ?? clip.end;
        const start = Math.max(0, Math.min(clip.start, anchor - 1.6));
        const end = Math.min(duration, clip.contact != null ? clip.contact + 0.15 : clip.end);
        const { frames, times } = await captureFrames(
          url,
          start,
          end,
          360,
          (p) => setAnalyses((a) => ({ ...a, [id]: { ...a[id], progress: p * 0.9 } })),
          fps,
        );
        if (frames.length < 6) throw new Error("Too few frames in this clip to track the ball.");
        const result = analyzeFrames(frames, times, clip.contact, { collect: true });
        setAnalyses((a) => ({ ...a, [id]: { status: "done", progress: 1, result, error: null } }));
        setMarks((all) => {
          const cur = all[id] ?? emptyMarks();
          const auto = (k: MarkKey, t: number | null) =>
            cur[k].source === "manual" ? cur[k] : { t, source: t == null ? null : ("auto" as const) };
          return {
            ...all,
            [id]: {
              release: auto("release", result.release),
              bounce: auto("bounce", result.bounce?.t ?? null),
              contact: auto("contact", clip.contact),
            },
          };
        });
      } catch (err) {
        setAnalyses((a) => ({
          ...a,
          [id]: { status: "error", progress: 0, result: null, error: (err as Error).message || "Tracking failed." },
        }));
      }
    },
    [url, meta, fps],
  );

  const seek = useCallback((t: number, play = false) => {
    const p = playerRef.current;
    if (!p) return;
    p.currentTime = Math.max(0, t);
    if (play) void p.play();
    else p.pause();
  }, []);
  const playhead = useCallback(() => playerRef.current?.currentTime ?? 0, []);

  const value: Ctx = {
    file,
    url,
    meta,
    loadFile,
    clearFile,
    audio,
    motion,
    scanForSilentBalls,
    scanWholeVideo,
    settings,
    setSettings,
    clips,
    addManualClip,
    removeClip,
    selectedId,
    select,
    analyses,
    analyze,
    marks,
    setMark,
    setup,
    setSetup,
    overlay,
    setOverlay,
    playerRef,
    seek,
    playhead,
  };
  return <VideoCtx.Provider value={value}>{children}</VideoCtx.Provider>;
}

/** Speed, length and line for a clip from its marks and the tracking setup. */
export function clipMetrics(m: Marks | undefined, a: BallAnalysis | null, setup: TrackingSetup) {
  const timing = { release: m?.release.t ?? null, bounce: m?.bounce.t ?? null, contact: m?.contact.t ?? null };
  const speed = speedKmh(timing, setup);
  const length = lengthM(timing, setup);
  let line: number | null = null;
  if (length != null && setup.stumps && a?.bounce && m?.bounce.source === "auto") {
    line = lineCm(a.bounce.x, setup.stumps, length, setup);
  }
  return { speed, length, line };
}
