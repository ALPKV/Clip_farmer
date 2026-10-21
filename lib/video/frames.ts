"use client";

import { toGray, type Gray } from "@/lib/tracking/core";

/**
 * Grabs every frame in [start, end] of a video as small grayscale images with their exact
 * presentation times. Plays a hidden copy of the video slowly and reads each new frame as the
 * browser presents it (requestVideoFrameCallback), so high-frame-rate slow-motion is not skipped.
 */
export async function captureFrames(
  src: string,
  start: number,
  end: number,
  maxWidth: number,
  onProgress?: (fraction: number) => void,
  fpsHint: number | null = null,
): Promise<{ frames: Gray[]; times: number[]; width: number; height: number }> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  // Kept in the page (some browsers stop decoding detached videos) but invisible.
  Object.assign(video.style, {
    position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0", pointerEvents: "none",
  });
  document.body.appendChild(video);
  try {
    await once(video, "loadedmetadata");
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const w = Math.max(1, Math.round(video.videoWidth * scale));
    const h = Math.max(1, Math.round(video.videoHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

    // First pass at half speed tells us the frame rate; slow-motion files get a slower second pass.
    // A hidden or busy tab can still drop frames; then step through the clip by seeking instead.
    let rate = 0.5;
    let fps = fpsHint ?? 30;
    if (document.visibilityState === "visible" && "requestVideoFrameCallback" in video) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const out = await pass(video, ctx, w, h, start, end, rate, onProgress);
        if (out.frames.length >= 3 && !fpsHint) fps = estimateFps(out.times);
        const dropped = out.dropped / Math.max(1, out.frames.length + out.dropped);
        if (out.frames.length >= 3 && dropped < 0.05) return { ...out, width: w, height: h };
        if (out.frames.length < 3 || rate <= 0.1) break;
        rate = Math.max(0.1, Math.min(rate / 2, 45 / fps));
      }
    }
    const stepped = await stepBySeeking(video, ctx, w, h, start, end, fps, onProgress);
    return { ...stepped, width: w, height: h };
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}

type PassResult = { frames: Gray[]; times: number[]; dropped: number };

async function pass(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  start: number,
  end: number,
  rate: number,
  onProgress?: (fraction: number) => void,
): Promise<PassResult> {
  video.pause();
  video.currentTime = Math.max(0, start);
  await once(video, "seeked");
  video.playbackRate = rate;
  const frames: Gray[] = [];
  const times: number[] = [];
  let dropped = 0;
  let lastPresented = -1;

  await new Promise<void>((resolve, reject) => {
    // If the browser stops presenting frames (hidden or throttled tab), give up quickly.
    let timer = setTimeout(() => resolve(), 1500);
    const onFrame = (_now: number, meta: VideoFrameCallbackMetadata) => {
      clearTimeout(timer);
      timer = setTimeout(() => resolve(), 1500);
      if (lastPresented >= 0 && meta.presentedFrames > lastPresented + 1) dropped += meta.presentedFrames - lastPresented - 1;
      lastPresented = meta.presentedFrames;
      if (meta.mediaTime >= start - 1e-3 && (times.length === 0 || meta.mediaTime > times[times.length - 1])) {
        ctx.drawImage(video, 0, 0, w, h);
        frames.push(toGray(ctx.getImageData(0, 0, w, h).data, w, h));
        times.push(meta.mediaTime);
        onProgress?.(Math.min(1, (meta.mediaTime - start) / (end - start)));
      }
      if (meta.mediaTime >= end || video.ended) {
        clearTimeout(timer);
        video.pause();
        resolve();
      } else {
        video.requestVideoFrameCallback(onFrame);
      }
    };
    video.requestVideoFrameCallback(onFrame);
    video.play().catch(reject);
  });
  return { frames, times, dropped };
}

/** Fallback: seek frame by frame (slower, but works in hidden tabs and older browsers). */
async function stepBySeeking(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  start: number,
  end: number,
  fps: number,
  onProgress?: (fraction: number) => void,
): Promise<PassResult> {
  video.pause();
  const step = 1 / Math.min(240, Math.max(10, fps));
  const frames: Gray[] = [];
  const times: number[] = [];
  // Seek to the middle of each frame so rounding never lands on the neighbouring one.
  for (let t = start + step / 2; t <= end; t += step) {
    video.currentTime = t;
    await once(video, "seeked");
    ctx.drawImage(video, 0, 0, w, h);
    frames.push(toGray(ctx.getImageData(0, 0, w, h).data, w, h));
    times.push(t);
    onProgress?.((t - start) / (end - start));
  }
  return { frames, times, dropped: 0 };
}

function estimateFps(times: number[]): number {
  const d = times.slice(1).map((t, i) => t - times[i]).sort((a, b) => a - b);
  const median = d[Math.floor(d.length / 2)] || 1 / 30;
  return 1 / median;
}

function once(el: HTMLElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      el.removeEventListener("error", bad);
      resolve();
    };
    const bad = () => {
      el.removeEventListener(event, ok);
      reject(new Error("This browser cannot play the video. Try an MP4 (H.264) file."));
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener("error", bad, { once: true });
  });
}
