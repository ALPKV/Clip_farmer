"use client";

import type { FFmpeg } from "@ffmpeg/ffmpeg";

/**
 * FFmpeg compiled to WebAssembly, running in a worker in the browser. The video file is mounted
 * read-only (WORKERFS), so even multi-gigabyte recordings are read in pieces, never copied whole.
 * The ~30 MB engine downloads once from a public CDN and is then cached by the browser.
 */

const CORE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
/** Served from public/ (see scripts/copy-ffmpeg.mjs) so its worker is same-origin. */
const FFMPEG_MODULE = "/vendor/ffmpeg/index.js";

let instance: Promise<FFmpeg> | null = null;

async function toBlobURL(url: string, type: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not download the video engine. Check your connection.");
  return URL.createObjectURL(new Blob([await res.arrayBuffer()], { type }));
}

async function getFFmpeg(): Promise<FFmpeg> {
  if (!instance) {
    instance = (async () => {
      const { FFmpeg } = (await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ FFMPEG_MODULE
      )) as typeof import("@ffmpeg/ffmpeg");
      const ff = new FFmpeg();
      await ff.load({
        coreURL: await toBlobURL(`${CORE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      return ff;
    })().catch((err) => {
      instance = null;
      throw err;
    });
  }
  return instance;
}

/** Runs `fn` with `file` mounted at /in/<name>. Only one job at a time. */
let queue: Promise<unknown> = Promise.resolve();
async function withFile<T>(file: File, fn: (ff: FFmpeg, path: string) => Promise<T>): Promise<T> {
  const job = queue.then(async () => {
    const ff = await getFFmpeg();
    const dir = "/in";
    await ff.createDir(dir).catch(() => {});
    await ff.mount("WORKERFS" as never, { files: [file] }, dir);
    try {
      return await fn(ff, `${dir}/${file.name}`);
    } finally {
      await ff.unmount(dir).catch(() => {});
    }
  });
  queue = job.catch(() => {});
  return job;
}

/** Mono 8 kHz audio as 32-bit floats, plus the video frame rate FFmpeg reports. */
export async function extractAudio(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<{ pcm: Float32Array; sampleRate: number; fps: number | null }> {
  const sampleRate = 8000;
  return withFile(file, async (ff, path) => {
    const handler = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(1, progress)));
    let fps: number | null = null;
    const logs = ({ message }: { message: string }) => {
      const m = fps == null && /Stream .*Video:.* ([\d.]+) fps/.exec(message);
      if (m) fps = Number(m[1]) || null;
    };
    ff.on("progress", handler);
    ff.on("log", logs);
    try {
      const code = await ff.exec(["-i", path, "-vn", "-ac", "1", "-ar", String(sampleRate), "-f", "f32le", "/audio.pcm"]);
      if (code !== 0) throw new Error("This video has no readable audio track.");
      const data = (await ff.readFile("/audio.pcm")) as Uint8Array;
      await ff.deleteFile("/audio.pcm");
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      return { pcm: new Float32Array(copy.buffer), sampleRate, fps };
    } finally {
      ff.off("progress", handler);
      ff.off("log", logs);
    }
  });
}

/** Cuts [start, start+duration) without re-encoding; the cut snaps to the keyframe before `start`. */
async function cut(ff: FFmpeg, path: string, start: number, duration: number, out: string) {
  const code = await ff.exec([
    "-ss", start.toFixed(3), "-i", path, "-t", duration.toFixed(3),
    "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-avoid_negative_ts", "make_zero", "-movflags", "+faststart", out,
  ]);
  if (code !== 0) throw new Error("FFmpeg could not cut this clip.");
}

export async function exportClip(file: File, start: number, duration: number): Promise<Blob> {
  return withFile(file, async (ff, path) => {
    await cut(ff, path, start, duration, "/clip.mp4");
    const data = (await ff.readFile("/clip.mp4")) as Uint8Array;
    await ff.deleteFile("/clip.mp4");
    return new Blob([data.slice()], { type: "video/mp4" });
  });
}

/** Joins the clips into one highlights reel (stream copy, so it takes seconds, not minutes). */
export async function exportReel(
  file: File,
  clips: { start: number; end: number }[],
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  return withFile(file, async (ff, path) => {
    const names: string[] = [];
    for (let k = 0; k < clips.length; k++) {
      const name = `/part${k}.mp4`;
      await cut(ff, path, clips[k].start, clips[k].end - clips[k].start, name);
      names.push(name);
      onProgress?.((k + 1) / (clips.length + 1));
    }
    await ff.writeFile("/list.txt", names.map((n) => `file '${n}'`).join("\n"));
    const code = await ff.exec(["-f", "concat", "-safe", "0", "-i", "/list.txt", "-c", "copy", "-movflags", "+faststart", "/reel.mp4"]);
    if (code !== 0) throw new Error("FFmpeg could not join the clips.");
    const data = (await ff.readFile("/reel.mp4")) as Uint8Array;
    for (const n of [...names, "/list.txt", "/reel.mp4"]) await ff.deleteFile(n).catch(() => {});
    onProgress?.(1);
    return new Blob([data.slice()], { type: "video/mp4" });
  });
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
