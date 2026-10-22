"use client";

import type { MotionSeries } from "@/lib/tracking/deliveries";

/**
 * Plays a hidden copy of the video fast (the browser's own decoder, so it is quick even for long
 * 4K sessions) and measures, about ten times a second of video, how much of a small grey copy of the
 * picture changed. That is enough to see a bowler run in and bowl. Nothing leaves the device.
 */
export async function scanMotion(
  src: string,
  onProgress?: (fraction: number) => void,
  isCancelled: () => boolean = () => false,
): Promise<MotionSeries> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  Object.assign(video.style, {
    position: "fixed", left: "0", top: "0", width: "2px", height: "2px", opacity: "0", pointerEvents: "none",
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
      if (time - prevT < 0.095) return;
      ctx.drawImage(video, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      const gray = new Uint8Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = (px[p] + 2 * px[p + 1] + px[p + 2]) >> 2;
      if (prev) {
        let moved = 0;
        for (let i = 0; i < gray.length; i++) if (Math.abs(gray[i] - prev[i]) > 20) moved++;
        out.t.push(time);
        out.m.push(moved / gray.length);
        gaps.push(time - prevT);
      }
      prev = gray;
      prevT = time;
      lastSample = Date.now();
      onProgress?.(Math.min(1, time / duration));
    };

    // As fast as the decoder keeps up with: speed up while frames arrive about every 0.1 s of video,
    // slow down when it starts skipping (big gaps would exaggerate the motion).
    video.playbackRate = 8;
    let stalled: (() => void) | null = null;
    const tune = setInterval(() => {
      if (Date.now() - lastSample > 10_000) stalled?.();
      if (gaps.length < 5) return;
      const recent = gaps.slice(-10).sort((a, b) => a - b)[Math.min(4, gaps.length - 1)];
      if (recent > 0.2 && video.playbackRate > 1) video.playbackRate = Math.max(1, video.playbackRate / 1.5);
      else if (recent < 0.13 && video.playbackRate < 16) video.playbackRate = Math.min(16, video.playbackRate * 1.25);
    }, 1000);

    try {
      await new Promise<void>((resolve, reject) => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        video.addEventListener("ended", finish, { once: true });
        // Some browsers never fire "ended" when the last frames can't be decoded: stop when nothing
        // new has arrived for 10 s, which is fine near the end and an error anywhere else.
        stalled = () => (prevT > duration - 3 ? finish() : reject(new Error("Scanning stalled. Try again, or use another browser.")));
        video.addEventListener("error", () => reject(new Error("Playback stopped while scanning.")), { once: true });
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
        video.play().catch(reject);
      });
    } finally {
      clearInterval(tune);
    }
    onProgress?.(1);
    return out;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }
}
