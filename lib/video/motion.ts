"use client";

import type { MotionSeries } from "@/lib/tracking/deliveries";

/**
 * Plays a hidden copy of the video fast (the browser's own decoder, so it is quick even for long
 * 4K sessions) and measures, about five times a second of video, how much of a small grey copy of the
 * picture changed. That is enough to see a bowler run in and bowl. Nothing leaves the device.
 */
export async function scanMotion(
  src: string,
  onProgress?: (fraction: number, slow: boolean) => void,
  isCancelled: () => boolean = () => false,
): Promise<MotionSeries> {
  let slow = false;
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  Object.assign(video.style, {
    position: "fixed", left: "0", bottom: "0", width: "16px", height: "16px", opacity: "0.01", pointerEvents: "none", zIndex: "1",
  });
  document.body.appendChild(video);
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("This video could not be played for scanning.")), { once: true });
    });
    const duration = video.duration;
    const s = 160 / Math.max(video.videoWidth, video.videoHeight);
    const w = Math.max(1, Math.round(video.videoWidth * s));
    const h = Math.max(1, Math.round(video.videoHeight * s));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    let prev: Uint8Array | null = null;
    let prevT = -1;
    const out: MotionSeries = { t: [], m: [] };
    const gaps: number[] = [];
    let lastSample = Date.now();

    const sample = (time: number) => {
      if (time - prevT < 0.195) return;
      ctx.drawImage(video, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      const gray = new Uint8Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = (px[p] + 2 * px[p + 1] + px[p + 2]) >> 2;
      // Frames far apart (the page was in the background) can't show a bowling action: skip the pair.
      if (prev && time - prevT <= 0.45) {
        let moved = 0;
        for (let i = 0; i < gray.length; i++) if (Math.abs(gray[i] - prev[i]) > 20) moved++;
        out.t.push(time);
        out.m.push(moved / gray.length);
      }
      if (prev) gaps.push(time - prevT);
      prev = gray;
      prevT = time;
      lastSample = Date.now();
      onProgress?.(Math.min(1, time / duration), slow);
    };

    // As fast as the decoder keeps up with: speed up while frames arrive about every 0.2 s of video
    // slow down when it starts skipping (big gaps would exaggerate the motion).
    video.playbackRate = 8;
    let stalled: (() => void) | null = null;
    // In the background (another app, a hidden tab) browsers stop playing video. Wait instead of
    // failing, and carry on when the page is visible again.
    const resume = () => {
      if (!document.hidden && video.paused && !video.ended) void video.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", resume);
    const tune = setInterval(() => {
      if (document.hidden) lastSample = Date.now();
      if (Date.now() - lastSample > 8_000) stalled?.();
      if (gaps.length < 5) return;
      const recent = gaps.slice(-10).sort((a, b) => a - b)[Math.min(4, gaps.length - 1)];
      if (recent > 0.35 && video.playbackRate > 1) video.playbackRate = Math.max(1, video.playbackRate / 1.5);
      else if (recent < 0.26 && video.playbackRate < 16) video.playbackRate = Math.min(16, video.playbackRate * 1.25);
    }, 1000);

    let outcome: "ended" | "stalled";
    try {
      outcome = await new Promise<"ended" | "stalled">((resolve, reject) => {
        let done = false;
        const finish = (how: "ended" | "stalled") => {
          if (!done) {
            done = true;
            resolve(how);
          }
        };
        video.addEventListener("ended", () => finish("ended"), { once: true });
        // No new frame for 8 s while the page is on screen: playback isn't working here (some phones
        // block background video, for example in Low Power Mode). Near the end it just means done.
        stalled = () => finish(prevT > duration - 3 ? "ended" : "stalled");
        video.addEventListener("error", () => finish("stalled"), { once: true });
        if (typeof (video as Partial<HTMLVideoElement>).requestVideoFrameCallback === "function") {
          const onFrame = (_: number, meta: { mediaTime: number }) => {
            if (done) return;
            if (isCancelled()) return reject(new Error("cancelled"));
            sample(meta.mediaTime);
            video.requestVideoFrameCallback(onFrame);
          };
          video.requestVideoFrameCallback(onFrame);
        } else {
          const poll = setInterval(() => {
            if (done) return clearInterval(poll);
            if (isCancelled()) {
              clearInterval(poll);
              return reject(new Error("cancelled"));
            }
            sample(video.currentTime);
          }, 25);
        }
        video.play().catch(() => finish("stalled"));
      });
    } finally {
      clearInterval(tune);
      document.removeEventListener("visibilitychange", resume);
    }

    // Fallback that works in every browser: jump through the rest of the video a fifth of a second
    // at a time and read each frame. Slower, but it doesn't depend on the video playing.
    if (outcome === "stalled") {
      slow = true;
      video.pause();
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const seekTo = (t: number) =>
        new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 4000);
          video.addEventListener("seeked", () => (clearTimeout(timer), resolve()), { once: true });
          video.currentTime = t;
        });
      for (let t = Math.max(0, prevT + 0.2); t < duration; t += 0.2) {
        if (isCancelled()) throw new Error("cancelled");
        while (document.hidden) await wait(500);
        await seekTo(t);
        sample(t);
      }
    }
    onProgress?.(1, slow);
    return out;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}
