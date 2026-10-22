import type { Candidate, Gray } from "./core.ts";
import weights from "./ball-model.json" with { type: "json" };

/**
 * A small ball / not-ball classifier (logistic regression) trained on hand-reviewed ball flights
 * from real net-session and match videos. It looks at a 9×9 patch around each moving blob, the
 * motion inside it, and the blob's shape, and returns a log-odds score: above 0 looks like a ball.
 * On footage it never saw it scores 0.90–0.96 AUC. See scripts/ball-model/README.md.
 */

export type BallModel = { patch: number; mu: number[]; sd: number[]; w: number[]; b: number };

export const ballModel: BallModel = weights;
/** Tag stored with shared training samples, so they can be matched to the model that chose them. */
export const MODEL_VERSION = `v${(weights as { version?: number }).version ?? 0}`;
/** 6 shape and brightness numbers, then the 9×9 patch, then its 9×9 motion. */
export const FEATURE_COUNT = 6 + 81 + 81;

/** Features must match the training script exactly (scripts/ball-model). */
export function ballFeatures(prev: Gray, cur: Gray, next: Gray, c: Candidate, patchSize = 9): number[] {
  const { w: W, h: H } = cur;
  const R = (patchSize - 1) / 2;
  const cx = Math.round(c.x);
  const cy = Math.round(c.y);
  const patch: number[] = [];
  const motion: number[] = [];
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const x = Math.min(W - 1, Math.max(0, cx + dx));
      const y = Math.min(H - 1, Math.max(0, cy + dy));
      const p = y * W + x;
      patch.push(cur.data[p]);
      motion.push(Math.min(Math.abs(cur.data[p] - prev.data[p]), Math.abs(next.data[p] - cur.data[p])));
    }
  }
  const mean = patch.reduce((a, b) => a + b, 0) / patch.length;
  const sd = Math.sqrt(patch.reduce((a, b) => a + (b - mean) ** 2, 0) / patch.length) || 1;
  const meanM = motion.reduce((a, b) => a + b, 0) / motion.length;
  const long = Math.max(c.bw, c.bh);
  const short = Math.min(c.bw, c.bh);
  return [
    Math.log(c.area),
    long / short,
    c.area / (c.bw * c.bh),
    Math.min(c.crowd ?? 0, 6) / 6,
    mean / 255,
    meanM / 255,
    ...patch.map((v) => (v - mean) / sd),
    ...motion.map((m) => m / 255),
  ];
}

/** Log-odds that the blob is the ball. */
export function ballScore(features: number[], m: BallModel = ballModel): number {
  let z = m.b;
  for (let k = 0; k < features.length; k++) z += m.w[k] * ((features[k] - m.mu[k]) / m.sd[k]);
  return z;
}
