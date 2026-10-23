"use client";

import { coveredSpans, type MotionSeries } from "@/lib/tracking/deliveries";

/**
 * Watches for bowling actions. A hidden copy of the video is played fast (the browser's own decoder,
 * so it is quick even for 4K) and, about five times a second of video, a small grey copy of the
 * picture is compared with the last one: a bowler running in and bowling changes a lot of it at
 * once. Nothing leaves the device.
 *
 * With `spans`, only those stretches are watched (Bat only needs just the 3 s before each bat
 * sound, often half the video or less); without, the whole video. If the browser won't play the
 * video (an iPhone in Low Power Mode, for example) each stretch is read frame by frame instead,
 * which works everywhere but is several times slower.
 */
export async function scanMotion(
  src: string,
  onProgress?: (fraction: number, slow: boolean) => void,
  isCancelled: () => boolean = () => false,
  spans?: [number, number][],
): Promise<MotionSeries> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = src;
  Object.assign(video.style, {
    position: "fixed", left: "0", bottom: "0", width: "16px", height: "16px", opacity: "0.01", pointerEvents: "none", zIndex: "1",
  });
  document.body.appendChild(video);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("This video could not be played for scanning.")), { once: true });
    });
    const duration = video.duration;
    const todo = mergeSpans(spans ?? [[0, duration]], duration);
    const total = todo.reduce((a, [x, y]) => a + (y - x), 0) || 1;
    let doneSec = 0;

    const s = 160 / Math.max(video.videoWidth, video.videoHeight);
    const w = Math.max(1, Math.round(video.videoWidth * s));
    const h = Math.max(1, Math.round(video.videoHeight * s));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const out: MotionSeries = { t: [], m: [] };
    let prev: Uint8Array | null = null;
    let prevT = -1;
    let slow = false;
    let lastSample = Date.now();
    const gaps: number[] = [];

    const sample = (time: number, spanStart: number) => {
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
      onProgress?.(Math.min(1, (doneSec + Math.max(0, time - spanStart)) / total), slow);
    };

    const seekTo = (t: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 4000);
        video.addEventListener("seeked", () => (clearTimeout(timer), resolve()), { once: true });
        video.currentTime = t;
      });

    /** Plays [a, b) fast and samples it. "stalled" when no frame arrives while the page is visible. */
    const playSpan = (a: number, b: number, patienceMs: number) =>
      new Promise<"done" | "stalled">((resolve, reject) => {
        let finished = false;
        const finish = (how: "done" | "stalled") => {
          if (finished) return;
          finished = true;
          clearInterval(tick);
          document.removeEventListener("visibilitychange", resume);
          video.pause();
          resolve(how);
        };
        // In the background browsers stop playing video: wait, and carry on when visible again.
        const resume = () => {
          if (!document.hidden && video.paused && !finished) void video.play().catch(() => finish("stalled"));
        };
        document.addEventListener("visibilitychange", resume);
        lastSample = Date.now();
        let choppy = 0;
        const tick = setInterval(() => {
          if (document.hidden) lastSample = Date.now();
          if (Date.now() - lastSample > patienceMs) finish(prevT > b - 1 ? "done" : "stalled");
          if (gaps.length < 5) return;
          // Frames still too far apart at normal speed: playback can't be used here, read frames instead.
          const median = gaps.slice(-10).sort((x, y) => x - y)[Math.min(4, gaps.length - 1)];
          choppy = !document.hidden && video.playbackRate <= 1 && median > 0.45 ? choppy + 1 : 0;
          if (choppy >= 3) return finish("stalled");
          // As fast as the decoder keeps up with: speed up while frames come about every 0.2 s of
          // video, slow down when it starts skipping (big gaps would exaggerate the motion).
          const recent = gaps.slice(-10).sort((x, y) => x - y)[Math.min(4, gaps.length - 1)];
          if (recent > 0.35 && video.playbackRate > 1) video.playbackRate = Math.max(1, video.playbackRate / 1.5);
          else if (recent < 0.26 && video.playbackRate < 16) video.playbackRate = Math.min(16, video.playbackRate * 1.25);
        }, 500);
        video.addEventListener("ended", () => finish("done"), { once: true });
        const onTime = (t: number) => {
          if (finished) return;
          if (isCancelled()) {
            finish("done");
            return reject(new Error("cancelled"));
          }
          if (t >= b) return finish("done");
          sample(t, a);
        };
        if (typeof (video as Partial<HTMLVideoElement>).requestVideoFrameCallback === "function") {
          const onFrame = (_: number, meta: { mediaTime: number }) => {
            onTime(meta.mediaTime);
            if (!finished) video.requestVideoFrameCallback(onFrame);
          };
          video.requestVideoFrameCallback(onFrame);
        } else {
          const poll = setInterval(() => (finished ? clearInterval(poll) : onTime(video.currentTime)), 25);
        }
        video.play().catch(() => finish("stalled"));
      });

    /** Fallback: jump through [a, b) a fifth of a second at a time and read each frame. */
    const seekSpan = async (a: number, b: number) => {
      for (let t = a; t < b; t += 0.2) {
        if (isCancelled()) throw new Error("cancelled");
        while (document.hidden) await wait(500);
        await seekTo(t);
        sample(t, a);
      }
    };

    // Short stretches start gently so frames arrive before the stretch is over; the speed control
    // then carries the best rate from one stretch to the next.
    video.playbackRate = spans ? 3 : 8;
    for (const [a, b] of todo) {
      // Each stretch starts fresh: nothing is compared across a jump.
      prev = null;
      prevT = -1;
      if (slow) await seekSpan(a, b);
      else {
        await seekTo(a);
        // A short stretch gets a few seconds to start playing; the whole video a little longer.
        if ((await playSpan(a, b, spans ? 4000 : 8000)) === "stalled") {
          slow = true;
          await seekSpan(Math.max(a, prevT + 0.2), b);
        }
      }
      doneSec += b - a;
      onProgress?.(Math.min(1, doneSec / total), slow);
    }
    // Second pass: any stretch playback didn't show clearly (frames too far apart) is read frame by
    // frame, so every bat sound gets a proper check.
    if (spans) {
      const seen = coveredSpans(out);
      for (const [a, b] of todo) {
        if (seen.some(([x, y]) => x <= a + 0.4 && y >= b - 0.2)) continue;
        prev = null;
        prevT = -1;
        await seekSpan(a, b);
      }
      sortSeries(out);
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

/** Puts samples back in time order after the second pass. */
function sortSeries(series: MotionSeries) {
  const order = series.t.map((_, i) => i).sort((x, y) => series.t[x] - series.t[y]);
  const t = order.map((i) => series.t[i]);
  const m = order.map((i) => series.m[i]);
  series.t = t;
  series.m = m;
}

/** Sorted, clipped to the video, and overlapping or nearly touching stretches joined. */
function mergeSpans(spans: [number, number][], duration: number): [number, number][] {
  const sorted = spans
    .map(([a, b]) => [Math.max(0, a), Math.min(duration, b)] as [number, number])
    .filter(([a, b]) => b > a)
    .sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    // Playing through a short gap is quicker than jumping over it.
    if (last && a <= last[1] + 1.5) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
