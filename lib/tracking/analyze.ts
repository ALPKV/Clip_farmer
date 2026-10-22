import {
  defaultDetectOptions,
  defaultTrackOptions,
  detect,
  findBounce,
  track,
  type Gray,
  type Scorer,
  type TrackPoint,
} from "./core.ts";
import { ballFeatures, ballScore } from "./model.ts";

/**
 * The trained ball model removes blobs it is confident are not the ball (limbs, bats, pads,
 * netting) before tracking. Threshold chosen on a held-out net session; see scripts/ball-model.
 */
const MODEL_MIN_SCORE = 1.5;
const modelScorer: Scorer = (prev, cur, next, c) => ballScore(ballFeatures(prev, cur, next, c));
/** A delivery's ball path must reach (or nearly reach) the bat contact. */
const MAX_GAP_TO_CONTACT = 0.35;

export type BallAnalysis = {
  /** Track points in normalised image coordinates (0–1), in time order. */
  points: { t: number; x: number; y: number; r: number }[];
  bounce: { t: number; x: number; y: number } | null;
  /** First tracked point when it plausibly is the release: the track starts before the bounce. */
  release: number | null;
  /** Why the release could not be found automatically, if it could not. */
  releaseNote: string | null;
  fps: number;
  /**
   * Model features of the tracked path and of other moving spots in the same frames. Kept in memory
   * only; shared (as numbers) when the player has opted in and says whether the path is the ball.
   */
  training: { track: number[][]; others: number[][]; w: number; h: number } | null;
};

/** At most this many other spots per frame, and in total, go with a path as "not the ball". */
const OTHERS_PER_FRAME = 2;
const MAX_OTHERS = 80;

/**
 * Tracks the ball through `frames` (timestamps `times`, seconds). With a known bat contact the
 * analysis stops at the contact, so the bat and the struck ball are not mistaken for the delivery.
 */
export function analyzeFrames(
  frames: Gray[],
  times: number[],
  contact: number | null,
  { useModel = true, collect = false }: { useModel?: boolean; collect?: boolean } = {},
): BallAnalysis {
  const n = frames.length;
  const dt = n > 1 ? (times[n - 1] - times[0]) / (n - 1) : 1 / 30;
  const fps = 1 / dt;
  let last = n - 1;
  if (contact != null) {
    while (last > 1 && times[last] > contact + 0.6 * dt) last--;
  }
  const { w, h } = frames[0];
  const dopt = {
    ...defaultDetectOptions(w, h),
    ...(useModel ? { scorer: modelScorer, minScore: MODEL_MIN_SCORE } : {}),
  };
  const cands = frames.slice(0, last + 1).map((f, i) =>
    i === 0 || i >= last ? [] : detect(frames[i - 1], f, frames[i + 1], dopt),
  );
  const prefer =
    contact != null ? (lastT: number) => -6 * Math.max(0, Math.abs(contact - lastT) / dt - 1.5) : undefined;
  let pts: TrackPoint[] = track(cands, times, { ...defaultTrackOptions(w, h), scoreWeight: useModel ? 0.8 : 0 }, prefer);
  // A path that stops well before the contact belongs to something else (often the previous ball).
  if (contact != null && pts.length && contact - pts[pts.length - 1].t > MAX_GAP_TO_CONTACT) pts = [];

  let training: BallAnalysis["training"] = null;
  if (collect && pts.length) {
    const track: number[][] = [];
    const others: number[][] = [];
    for (const p of pts) {
      if (p.i < 1 || p.i >= last) continue;
      const here = cands[p.i];
      const own = here.find((c) => Math.hypot(c.x - p.x, c.y - p.y) <= 1.5);
      // Points filled in across a gap or a bounce have no blob of their own.
      if (!own) continue;
      const feats = (c: (typeof here)[number]) => ballFeatures(frames[p.i - 1], frames[p.i], frames[p.i + 1], c);
      track.push(feats(own));
      for (const c of here.filter((c) => Math.hypot(c.x - p.x, c.y - p.y) > 6).slice(0, OTHERS_PER_FRAME)) {
        if (others.length < MAX_OTHERS) others.push(feats(c));
      }
    }
    training = { track, others, w, h };
  }

  const bounce = findBounce(pts);
  let release: number | null = null;
  let releaseNote: string | null = null;
  if (pts.length === 0) {
    releaseNote = "No ball path found leading to the contact. Mark the release and bounce by hand.";
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
    training,
  };
}
