import type { SoundDelivery } from "./hits.ts";

/**
 * Seeing the bowler bowl. When a bowler runs in and lets go, a big part of the picture moves at once,
 * so a delivery shows up as a sharp peak in how much of the frame changes. Peaks come about every
 * ball (and rarely otherwise), which catches the deliveries that make no bat sound: misses, leaves,
 * and balls that beat the bat.
 */

export type MotionSeries = { t: number[]; m: number[] };
export type MotionPeak = { t: number; height: number };

/** Resamples the motion series to 10 per second, smooths it, and finds peaks at least 2 s apart. */
export function motionPeaks(series: MotionSeries, minProminence = 0.02): MotionPeak[] {
  const { t, m } = series;
  if (t.length < 3) return [];
  const end = t[t.length - 1];
  const grid: number[] = [];
  let j = 0;
  for (let s = t[0]; s <= end; s += 0.1) {
    while (j < t.length - 2 && t[j + 1] < s) j++;
    const f = t[j + 1] > t[j] ? Math.min(1, Math.max(0, (s - t[j]) / (t[j + 1] - t[j]))) : 0;
    grid.push(m[j] + f * (m[j + 1] - m[j]));
  }
  const g = grid.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let k = Math.max(0, i - 1); k <= Math.min(grid.length - 1, i + 1); k++, n++) sum += grid[k];
    return sum / n;
  });
  const cands: MotionPeak[] = [];
  for (let i = 1; i < g.length - 1; i++) {
    if (!(g[i] > g[i - 1] && g[i] >= g[i + 1])) continue;
    // Prominence: height above the higher of the two valleys that separate it from taller peaks.
    let left = g[i];
    for (let k = i - 1; k >= 0 && g[k] <= g[i]; k--) left = Math.min(left, g[k]);
    let right = g[i];
    for (let k = i + 1; k < g.length && g[k] <= g[i]; k++) right = Math.min(right, g[k]);
    const prominence = g[i] - Math.max(left, right);
    if (prominence >= minProminence) cands.push({ t: t[0] + i * 0.1, height: g[i] });
  }
  // Keep the tallest peak in any 2 s stretch.
  const kept: MotionPeak[] = [];
  for (const c of [...cands].sort((a, b) => b.height - a.height)) {
    if (kept.every((k) => Math.abs(k.t - c.t) >= 2)) kept.push(c);
  }
  return kept.sort((a, b) => a.t - b.t);
}

export type Delivery = {
  /** Bat or stumps contact from the sound, or where the ball should reach the batter if it made none. */
  t: number;
  kind: "bat" | "no-sound";
  /** Sound strength against the session's loud hits, in dB (0 is a big hit). */
  rel: number | null;
};

/**
 * All deliveries: every sound delivery above `thresholdDb`, plus every bowling action with no such
 * sound in the 2.6 s after it (the ball reaches the batter about a second after release).
 */
export function combineDeliveries(sounds: SoundDelivery[], peaks: MotionPeak[] | null, thresholdDb: number): Delivery[] {
  const heard: Delivery[] = sounds.filter((s) => s.rel > thresholdDb).map((s) => ({ t: s.contact, kind: "bat", rel: s.rel }));
  const silent: Delivery[] = (peaks ?? [])
    .filter((p) => !heard.some((h) => h.t >= p.t - 0.3 && h.t <= p.t + 2.6))
    .map((p) => ({ t: p.t + 0.9, kind: "no-sound", rel: null }));
  return [...heard, ...silent].sort((a, b) => a.t - b.t);
}
