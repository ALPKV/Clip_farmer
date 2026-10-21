"use client";

import { useRef, useState } from "react";
import { Button } from "../ui";
import { useVideo } from "./video-context";

export function VideoDrop() {
  const { loadFile } = useVideo();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function pick(files: FileList | null) {
    const f = files?.[0];
    if (f) loadFile(f);
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
      className={`flex flex-col items-center justify-center gap-4 border-2 border-dashed px-6 py-16 text-center transition-colors ${
        over ? "border-gold bg-gold/10" : "border-navy/25 bg-white"
      }`}
    >
      <svg viewBox="0 0 48 48" className="h-12 w-12 text-navy" aria-hidden>
        <rect x="4" y="10" width="30" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M34 20l10-6v20l-10-6z" fill="currentColor" />
      </svg>
      <div>
        <p className="display text-2xl font-extrabold text-navy">Drop a net session video</p>
        <p className="mt-1 text-sm text-slate">
          MP4 or MOV from your phone. It stays on this device. Nothing is uploaded.
        </p>
      </div>
      <Button tone="navy" onClick={() => input.current?.click()}>Choose video</Button>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/quicktime,video/*"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />
      <p className="max-w-lg text-xs text-mute">
        Best results: tripod, 60 fps or more, the bowler&apos;s release and the batter both in view.
      </p>
    </div>
  );
}

export function FileBar() {
  const { file, meta, clearFile, audio } = useVideo();
  if (!file) return null;
  const mb = file.size / (1024 * 1024);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-line bg-white px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="eyebrow text-mute">Video</p>
        <p className="truncate font-semibold text-ink">{file.name}</p>
      </div>
      <Info label="Size" value={mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(0)} MB`} />
      <Info label="Length" value={meta ? clock(meta.duration) : "…"} />
      <Info label="Frame" value={meta ? `${meta.width}×${meta.height}` : "…"} />
      <Info
        label="Audio scan"
        value={
          audio.status === "loading"
            ? `${Math.round(audio.progress * 100)}%`
            : audio.status === "ready"
              ? "Done"
              : audio.status === "none"
                ? "No audio"
                : audio.status === "error"
                  ? "Failed"
                  : "—"
        }
      />
      <button onClick={clearFile} className="ml-auto font-display text-sm font-bold uppercase tracking-wider text-navy underline-offset-4 hover:underline">
        Change video
      </button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow text-mute">{label}</p>
      <p className="font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

export function clock(sec: number) {
  if (!Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
}
