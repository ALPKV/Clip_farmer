import type { SoundDelivery } from "./hits.ts";

/**
 * Seeing the bowler bowl. When a bowler runs in and lets go, a big part of the picture moves at once,
 * so a delivery shows up as a sharp peak in how much of the frame changes. Peaks come about every
 * ball (and rarely otherwise), which catches the deliveries that make no bat sound: misses, leaves,
 * and balls that beat the bat.
 */

export type MotionSeries = { t: number[]; m: number[] };
export type MotionPeak = { t: number; height: number };

/**
 * Stretches where the scan got a picture at least every 0.45 s. When the page is in the background a
 * browser may hand over only one frame a second, which is too coarse to see a bowler: those
 * stretches are left out, and Bat only keeps every sound in them.
 */
export function coveredSpans(series: MotionSeries, maxGap = 0.45): [number, number][] {
  const spans: [number, number][] = [];
  const { t } = series;
  for (let i = 1; i < t.length; i++) {
    if (t[i] - t[i - 1] > maxGap) continue;
    const last = spans[spans.length - 1];
    if (last && last[1] >= t[i - 1] - 1e-6) last[1] = t[i];
    else spans.push([t[i - 1], t[i]]);
  }
  return spans;
}

/** Total length of a set of stretches, counting overlaps once. */
export function coveredLength(spans: [number, number][]): number {
  let total = 0;
  let end = -Infinity;
  for (const [a, b] of [...spans].sort((x, y) => x[0] - y[0])) {
    if (b <= end) continue;
    total += b - Math.max(a, end);
    end = b;
  }
  return total;
}

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
 * All deliveries from bat sounds above `thresholdDb`.
 *
 * - `batOnly` (with the motion scan done): a bat sound counts only if a bowling action came 0–3 s
 *   before it. Talking, the ball being thrown back and other nets' noise have no bowler in front of
 *   them. On a session with lots of chatter this cut fake clips from 13 to 1 (scripts/deliveries).
 * - `addSilent`: also every bowling action with no bat sound in the 2.6 s after it (misses, leaves).
 */
export function combineDeliveries(
  sounds: SoundDelivery[],
  peaks: MotionPeak[] | null,
  thresholdDb: number,
  {
    batOnly = false,
    addSilent = false,
    covered,
  }: { batOnly?: boolean; addSilent?: boolean; covered?: [number, number][] } = {},
): Delivery[] {
  let heard: Delivery[] = sounds.filter((s) => s.rel > thresholdDb).map((s) => ({ t: s.contact, kind: "bat", rel: s.rel }));
  // The scan must have seen the time before a sound clearly to rule it out.
  const seen = (t: number) => !covered || covered.some(([a, b]) => a <= t - 2.8 && b >= t + 0.1);
  if (batOnly && peaks) {
    heard = heard.filter((h) => !seen(h.t) || peaks.some((p) => h.t - p.t >= -0.2 && h.t - p.t <= 3));
  }
  const silent: Delivery[] = addSilent
    ? (peaks ?? [])
        .filter((p) => !heard.some((h) => h.t >= p.t - 0.3 && h.t <= p.t + 2.6))
        .map((p) => ({ t: p.t + 0.9, kind: "no-sound", rel: null }))
    : [];
  return [...heard, ...silent].sort((a, b) => a.t - b.t);
}

export const deliveryId = (d: Delivery) => `${d.kind === "bat" ? "a" : "s"}${d.t.toFixed(3)}`;

/**
 * The clip around each delivery: `leadIn` before it and `length` long, but never reaching into the
 * neighbouring deliveries, so every ball keeps its own clip however close the next one is. Pass only
 * the deliveries being kept (not ones marked Not a shot), so a removed fake doesn't shorten its
 * neighbours.
 */
export function clipWindows(
  deliveries: Delivery[],
  leadIn: number,
  length: number,
  duration = Infinity,
): { delivery: Delivery; start: number; end: number }[] {
  const list = [...deliveries].sort((a, b) => a.t - b.t);
  return list.map((d, k) => {
    // A ball with no bat sound is anchored where it reaches the batter; show its release too.
    const extra = d.kind === "no-sound" ? 0.5 : 0;
    let start = Math.max(0, d.t - leadIn - extra);
    let end = Math.min(duration, start + length + extra);
    const prev = list[k - 1];
    const next = list[k + 1];
    if (prev) start = Math.min(Math.max(start, (prev.t + d.t) / 2, prev.t + 0.3), d.t - 0.2);
    if (next) end = Math.max(Math.min(end, (d.t + next.t) / 2, next.t - 0.3), d.t + 0.2);
    return { delivery: d, start, end: Math.min(duration, end) };
  });
}
