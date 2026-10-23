"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clipMetrics, useVideo, type Clip } from "./video-context";

/**
 * The video player. With tracking on, the ball path, bounce and speed are drawn over the same
 * video; with it off you see the untouched footage.
 */
export function Stage({
  clip,
  calibrating,
  onCalibrate,
}: {
  clip: Clip | null;
  calibrating?: boolean;
  onCalibrate?: (x: number) => void;
}) {
  const { url, meta, playerRef, overlay, setOverlay, analyses, marks, setup, clips, select } = useVideo();
  // Set when playback starts at a clip's start (Play clip, or Play in the list): stop at its end.
  // Playing the whole video from anywhere else just keeps going.
  const stopAt = useRef<number | null>(null);
  const ratio = meta && meta.width && meta.height ? meta.height / meta.width : 9 / 16;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [fps, setFps] = useState(30);
  const analysis = clip ? analyses[clip.id]?.result ?? null : null;
  const clipMarks = clip ? marks[clip.id] : undefined;
  const speed = clip ? clipMetrics(clipMarks, analysis, setup).speed : null;

  // Track the playhead precisely (per presented frame where supported).
  useEffect(() => {
    const v = playerRef.current;
    if (!v) return;
    let handle = 0;
    let last = -1;
    const tick = (_: number, meta?: VideoFrameCallbackMetadata) => {
      const t = meta?.mediaTime ?? v.currentTime;
      if (meta && last >= 0 && t > last) setFps((f) => 0.9 * f + 0.1 * Math.min(480, 1 / (t - last)));
      last = t;
      setTime(t);
      handle = "requestVideoFrameCallback" in v ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(() => tick(0));
    };
    handle = "requestVideoFrameCallback" in v ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(() => tick(0));
    const onSeek = () => setTime(v.currentTime);
    v.addEventListener("seeked", onSeek);
    return () => {
      if ("cancelVideoFrameCallback" in v) v.cancelVideoFrameCallback(handle);
      cancelAnimationFrame(handle);
      v.removeEventListener("seeked", onSeek);
    };
  }, [playerRef, url]);

  useEffect(() => {
    const v = playerRef.current;
    if (!v) return;
    const onPlay = () => {
      stopAt.current = clip && Math.abs(v.currentTime - clip.start) < 0.3 ? clip.end : null;
    };
    v.addEventListener("play", onPlay);
    return () => v.removeEventListener("play", onPlay);
  }, [clip, playerRef]);

  // Stop at the end of the clip being played.
  useEffect(() => {
    const v = playerRef.current;
    if (v && stopAt.current != null && !v.paused && time >= stopAt.current) {
      stopAt.current = null;
      v.pause();
    }
  }, [time, playerRef]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const v = playerRef.current;
    const box = boxRef.current;
    if (!canvas || !v || !box) return;
    const dpr = window.devicePixelRatio || 1;
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    canvas.width = Math.round(bw * dpr);
    canvas.height = Math.round(bh * dpr);
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, bw, bh);
    if (!v.videoWidth) return;
    // Area of the box the video actually occupies (object-fit: contain).
    const s = Math.min(bw / v.videoWidth, bh / v.videoHeight);
    const vw = v.videoWidth * s;
    const vh = v.videoHeight * s;
    const ox = (bw - vw) / 2;
    const oy = (bh - vh) / 2;
    const X = (x: number) => ox + x * vw;
    const Y = (y: number) => oy + y * vh;

    if (setup.stumps && (calibrating || overlay)) {
      ctx.strokeStyle = "#ffc700";
      ctx.lineWidth = 2;
      for (const x of [setup.stumps.leftX, setup.stumps.rightX]) {
        ctx.beginPath();
        ctx.moveTo(X(x), oy + vh * 0.02);
        ctx.lineTo(X(x), oy + vh * 0.98);
        ctx.setLineDash([6, 6]);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (!overlay || !analysis || analysis.points.length === 0) return;

    const pts = analysis.points.filter((p) => p.t <= time + 1e-3);
    // Fading trail of where the ball has been, then the ball now.
    for (let k = 1; k < pts.length; k++) {
      const a = pts[k - 1];
      const b = pts[k];
      const age = Math.max(0, time - b.t);
      ctx.strokeStyle = `rgba(255, 199, 0, ${Math.max(0.35, 1 - age * 1.5)})`;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(X(a.x), Y(a.y));
      ctx.lineTo(X(b.x), Y(b.y));
      ctx.stroke();
    }
    for (const p of pts) {
      ctx.fillStyle = "#00175f";
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffc700";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const now = pts[pts.length - 1];
    if (now && time - now.t < 0.12) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(X(now.x), Y(now.y), Math.max(9, now.r * vw * 1.6), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (analysis.bounce && time >= analysis.bounce.t) {
      const bx = X(analysis.bounce.x);
      const by = Y(analysis.bounce.y);
      ctx.fillStyle = "rgba(200, 16, 46, 0.9)";
      ctx.beginPath();
      ctx.ellipse(bx, by, 11, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, "BOUNCE", bx + 12, by + 4);
    }
    if (speed != null) {
      const text = `${speed.toFixed(0)} KM/H`;
      ctx.font = "800 italic 26px var(--font-barlow-condensed), sans-serif";
      const w = ctx.measureText(text).width + 24;
      ctx.fillStyle = "#00175f";
      ctx.fillRect(ox + 12, oy + 12, w, 40);
      ctx.fillStyle = "#ffc700";
      ctx.fillRect(ox + 12, oy + 12, 5, 40);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(text, ox + 24, oy + 42);
    }
  }, [analysis, overlay, time, setup.stumps, calibrating, speed, playerRef]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  }, [draw]);

  function step(frames: number) {
    const v = playerRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = Math.max(0, v.currentTime + frames / Math.max(1, fps));
  }

  function playClip() {
    const v = playerRef.current;
    if (!v || !clip) return;
    v.currentTime = clip.start;
    void v.play();
  }

  function onClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!calibrating || !onCalibrate) return;
    const v = playerRef.current;
    const box = boxRef.current;
    if (!v || !box || !v.videoWidth) return;
    const r = box.getBoundingClientRect();
    const s = Math.min(r.width / v.videoWidth, r.height / v.videoHeight);
    const ox = (r.width - v.videoWidth * s) / 2;
    const x = (e.clientX - r.left - ox) / (v.videoWidth * s);
    if (x >= 0 && x <= 1) onCalibrate(x);
  }

  if (!url) return null;
  return (
    <div className="bg-navy-950">
      <div
        ref={boxRef}
        onClick={onClick}
        className={`relative mx-auto max-w-full ${calibrating ? "cursor-crosshair" : ""}`}
        style={{ aspectRatio: `1 / ${ratio}`, height: `min(70vh, calc((100vw - 32px) * ${ratio}))` }}
      >
        <video
          ref={playerRef}
          src={url}
          className="absolute inset-0 h-full w-full object-contain"
          controls={!calibrating}
          playsInline
          preload="auto"
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        {calibrating ? (
          <p className="absolute inset-x-0 top-0 bg-gold px-3 py-2 text-center font-display text-sm font-bold uppercase tracking-wide text-navy-950">
            Click the base of the off stump, then the leg stump
          </p>
        ) : null}
      </div>
      {meta?.duration && clips.length > 0 ? (
        <ClipBar
          duration={meta.duration}
          time={time}
          clips={clips}
          selectedId={clip?.id ?? null}
          onSeek={(t) => {
            const v = playerRef.current;
            if (v) v.currentTime = t;
          }}
          onPick={(c) => {
            select(c.id);
            const v = playerRef.current;
            if (v) v.currentTime = c.start;
          }}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-3 py-2 text-white">
        <ToggleTracking on={overlay} onChange={setOverlay} />
        <div className="mx-1 h-6 w-px bg-white/15" />
        <IconBtn label="Back one frame" onClick={() => step(-1)}>◀︎ 1F</IconBtn>
        <IconBtn label="Forward one frame" onClick={() => step(1)}>1F ▶︎</IconBtn>
        {clip ? <IconBtn label="Play this clip" onClick={playClip}>Play clip</IconBtn> : null}
        <span className="ml-auto font-display text-sm tabular-nums tracking-wide text-white/70">
          {time.toFixed(3)} s · ~{Math.round(fps)} fps
        </span>
      </div>
    </div>
  );
}

/**
 * The whole session as a bar with every clip marked on it (gold: bat sound, outline: no bat sound,
 * grey: added by hand). Tap a mark to jump to that clip; tap anywhere else to jump there.
 */
function ClipBar({
  duration,
  time,
  clips,
  selectedId,
  onSeek,
  onPick,
}: {
  duration: number;
  time: number;
  clips: Clip[];
  selectedId: string | null;
  onSeek: (t: number) => void;
  onPick: (c: Clip) => void;
}) {
  const pct = (t: number) => `${Math.min(100, Math.max(0, (t / duration) * 100))}%`;
  return (
    <div className="border-t border-white/10 px-3 pb-1 pt-2">
      <div
        className="relative h-7 cursor-pointer bg-white/10"
        role="slider"
        aria-label="Session timeline with clips marked"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        tabIndex={0}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSeek(((e.clientX - r.left) / r.width) * duration);
        }}
      >
        {clips.map((c, k) => {
          const sel = c.id === selectedId;
          const tone = c.kind === "bat" ? "bg-gold border-gold" : c.kind === "no-sound" ? "bg-transparent border-gold" : "bg-white/50 border-white/50";
          return (
            <button
              key={c.id}
              type="button"
              title={`Clip ${k + 1}`}
              aria-label={`Clip ${k + 1}`}
              onClick={(e) => {
                e.stopPropagation();
                onPick(c);
              }}
              className={`absolute top-1 bottom-1 min-w-[3px] border ${tone} ${sel ? "ring-2 ring-white" : "opacity-80 hover:opacity-100"}`}
              style={{ left: pct(c.start), width: pct(c.end - c.start) }}
            />
          );
        })}
        <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: pct(time) }} />
      </div>
      <p className="mt-1 text-[0.7rem] text-white/50">Tap a mark to jump to that clip, or play the whole video and watch them go by.</p>
    </div>
  );
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = "700 13px var(--font-barlow-condensed), sans-serif";
  const w = ctx.measureText(text).width + 10;
  ctx.fillStyle = "rgba(0, 10, 46, 0.85)";
  ctx.fillRect(x, y - 13, w, 18);
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x + 5, y);
}

export function ToggleTracking({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="group inline-flex items-center gap-2.5 px-2 py-1 font-display text-sm font-bold uppercase tracking-wider"
    >
      <span aria-hidden className={`relative inline-block h-5 w-9 shrink-0 transition-colors ${on ? "bg-gold" : "bg-white/20"}`}>
        <span className={`absolute left-0 top-0.5 block h-4 w-4 bg-navy-950 transition-transform ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </span>
      Speed &amp; ball tracking {on ? "on" : "off"}
    </button>
  );
}

function IconBtn({ label: l, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={l}
      title={l}
      onClick={onClick}
      className="border border-white/20 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider text-white/85 hover:border-gold hover:text-gold"
    >
      {children}
    </button>
  );
}
