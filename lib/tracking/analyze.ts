import {
  defaultDetectOptions,
  defaultTrackOptions,
  detect,
  findBounce,
  track,
  type Gray,
  type TrackPoint,
} from "./core.ts";

export type BallAnalysis = {
  /** Track points in normalised image coordinates (0–1), in time order. */
  points: { t: number; x: number; y: number; r: number }[];
  bounce: { t: number; x: number; y: number } | null;
  /** First tracked point when it plausibly is the release: the track starts before the bounce. */
  release: number | null;
  /** Why the release could not be found automatically, if it could not. */
  releaseNote: string | null;
  fps: number;
};

/**
 * Tracks the ball through `frames` (timestamps `times`, seconds). With a known bat contact the
 * analysis stops at the contact, so the bat and the struck ball are not mistaken for the delivery.
 */
export function analyzeFrames(frames: Gray[], times: number[], contact: number | null): BallAnalysis {
  const n = frames.length;
  const dt = n > 1 ? (times[n - 1] - times[0]) / (n - 1) : 1 / 30;
  const fps = 1 / dt;
  let last = n - 1;
  if (contact != null) {
    while (last > 1 && times[last] > contact + 0.6 * dt) last--;
  }
  const { w, h } = frames[0];
  const dopt = defaultDetectOptions(w, h);
  const cands = frames.slice(0, last + 1).map((f, i) =>
    i === 0 || i >= last ? [] : detect(frames[i - 1], f, frames[i + 1], dopt),
  );
  const prefer =
    contact != null ? (lastT: number) => -6 * Math.max(0, Math.abs(contact - lastT) / dt - 1.5) : undefined;
  const pts: TrackPoint[] = track(cands, times, defaultTrackOptions(w, h), prefer);

  const bounce = findBounce(pts);
  let release: number | null = null;
  let releaseNote: string | null = null;
  if (pts.length === 0) {
    releaseNote = "No ball track found.";
  } else if (bounce && bounce.index >= 3) {
    release = pts[0].t;
    releaseNote =
      "Release is set to the first frame the ball was seen. If it appears after leaving the hand, set the release by hand.";
  } else {
    releaseNote = "The ball is first seen after it bounced, so the release is out of view. Mark it by hand.";
  }

  return {
    points: pts.map((p) => ({ t: p.t, x: p.x / w, y: p.y / h, r: p.r / w })),
    bounce: bounce ? { t: bounce.t, x: bounce.x / w, y: bounce.y / h } : null,
    release,
    releaseNote,
    fps,
  };
}
