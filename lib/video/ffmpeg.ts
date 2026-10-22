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

/**
 * Shuts the engine down. WebAssembly memory only grows, so after a big job the worker would keep
 * holding hundreds of megabytes (and a copy of whatever it last made); the next job starts fresh.
 */
export function releaseEngine() {
  const old = instance;
  instance = null;
  void old?.then((ff) => ff.terminate()).catch(() => {});
}

type Mount = { files?: File[]; blobs?: { name: string; data: Blob }[] };

/**
 * Runs `fn` with the inputs mounted read-only at `dir`. Only one job at a time. The engine is shut
 * down afterwards when `release` is set, and always after a failure (it may have run out of memory).
 */
let queue: Promise<unknown> = Promise.resolve();
async function withMount<T>(dir: string, inputs: Mount, fn: (ff: FFmpeg) => Promise<T>, release = false): Promise<T> {
  const job = queue.then(async () => {
    const ff = await getFFmpeg();
    let ok = false;
    try {
      await ff.createDir(dir).catch(() => {});
      await ff.mount("WORKERFS" as never, inputs, dir);
      const result = await fn(ff);
      ok = true;
      return result;
    } finally {
      await ff.unmount(dir).catch(() => {});
      if (release || !ok) releaseEngine();
    }
  });
  queue = job.catch(() => {});
  return job;
}

/** Runs `fn` with `file` mounted at /in/<name>. */
function withFile<T>(file: File, fn: (ff: FFmpeg, path: string) => Promise<T>, release = false): Promise<T> {
  return withMount("/in", { files: [file] }, (ff) => fn(ff, `/in/${file.name}`), release);
}

function friendly(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (/memory|abort|terminat|RuntimeError|OOM/i.test(msg)) {
    return new Error("This device ran out of memory making the video. Untick some clips, or tick Exact cuts for a smaller file.");
  }
  return err instanceof Error ? err : new Error(msg);
}

/**
 * Mono 16 kHz audio as 16-bit integers (enough for the 1.5–7.5 kHz click of bat on ball, at half the
 * memory of floats: about 2 MB a minute), plus the video frame rate FFmpeg reports.
 */
export async function extractAudio(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<{ pcm: Int16Array; sampleRate: number; fps: number | null }> {
  const sampleRate = 16000;
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
      const code = await ff.exec(["-i", path, "-vn", "-ac", "1", "-ar", String(sampleRate), "-f", "s16le", "/audio.pcm"]);
      if (code !== 0) throw new Error("This video has no readable audio track.");
      const data = (await ff.readFile("/audio.pcm")) as Uint8Array;
      await ff.deleteFile("/audio.pcm");
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      return { pcm: new Int16Array(copy.buffer), sampleRate, fps };
    } finally {
      ff.off("progress", handler);
      ff.off("log", logs);
    }
  });
}

/**
 * Cuts [start, start+duration). Fast mode copies the stream (seconds, original quality, but the cut
 * snaps to the keyframe before `start`). Precise mode re-encodes, so every clip starts on the exact
 * frame; it is slower and scales anything larger than 1080p down to 1080p.
 */
async function cut(ff: FFmpeg, path: string, start: number, duration: number, out: string, precise = false) {
  const codec = precise
    ? ["-vf", "scale='min(1080,iw)':-2", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2"]
    : ["-c", "copy", "-avoid_negative_ts", "make_zero"];
  const code = await ff.exec([
    "-ss", start.toFixed(3), "-i", path, "-t", duration.toFixed(3),
    "-map", "0:v:0", "-map", "0:a:0?", ...codec, "-movflags", "+faststart", out,
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

/**
 * Joins the clips, in order, into one highlights video. Each piece is moved out of the engine as
 * soon as it is cut and read back from there for the join, so the engine never holds more than one
 * piece plus the finished video, and it is shut down afterwards to give that memory back.
 */
export async function exportReel(
  file: File,
  clips: { start: number; end: number }[],
  onProgress?: (fraction: number) => void,
  { precise = false }: { precise?: boolean } = {},
): Promise<Blob> {
  try {
    const parts = await withFile(file, async (ff, path) => {
      const out: { name: string; data: Blob }[] = [];
      for (let k = 0; k < clips.length; k++) {
        await cut(ff, path, clips[k].start, clips[k].end - clips[k].start, "/part.mp4", precise);
        const data = (await ff.readFile("/part.mp4")) as Uint8Array;
        await ff.deleteFile("/part.mp4");
        out.push({ name: `p${k}.mp4`, data: new Blob([data.slice()], { type: "video/mp4" }) });
        onProgress?.((k + 1) / (clips.length + 1));
      }
      return out;
    });
    return await withMount(
      "/parts",
      { blobs: parts },
      async (ff) => {
        await ff.writeFile("/list.txt", parts.map((p) => `file '/parts/${p.name}'`).join("\n"));
        const code = await ff.exec(["-f", "concat", "-safe", "0", "-i", "/list.txt", "-c", "copy", "-movflags", "+faststart", "/reel.mp4"]);
        if (code !== 0) throw new Error("FFmpeg could not join the clips.");
        const data = (await ff.readFile("/reel.mp4")) as Uint8Array<ArrayBuffer>;
        onProgress?.(1);
        return new Blob([data], { type: "video/mp4" });
      },
      true,
    );
  } catch (err) {
    throw friendly(err);
  }
}

/** Rough size of a highlights video, used to split one that would not fit in memory. */
export function estimateBytes(fileSize: number, duration: number, clipSeconds: number, clipCount: number, precise: boolean) {
  const rate = fileSize / Math.max(1, duration);
  // Fast cuts start at the keyframe before each clip, which adds about a second each.
  return precise ? Math.min(rate, 2.5e6) * clipSeconds : rate * (clipSeconds + clipCount);
}

/** How big one highlights video can safely be on this device. Phones and tablets get far less memory. */
export function reelBudget(): number {
  const touch = typeof window !== "undefined" && navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches;
  return touch ? 300e6 : 900e6;
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Phones and tablets that can hand a video to the system share sheet, which has Save Video on an
 * iPhone and the gallery apps on Android. Browsers only allow this straight after a tap.
 */
export function canSaveToPhotos(): boolean {
  if (typeof navigator === "undefined" || !navigator.canShare || navigator.maxTouchPoints === 0) return false;
  try {
    return navigator.canShare({ files: [new File([], "clip.mp4", { type: "video/mp4" })] });
  } catch {
    return false;
  }
}

export function isApple(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
}

/** Opens the share sheet with the video. Cancelling it is not an error. */
export async function saveToPhotos(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: "video/mp4" });
  try {
    await navigator.share({ files: [file] });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    throw new Error("Couldn't open the share sheet. Use Download instead.");
  }
}
