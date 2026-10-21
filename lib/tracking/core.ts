/**
 * Ball tracking for a fixed (tripod) camera. Pure functions, no browser APIs, so they run in tests.
 *
 * 1. detect: three-frame differencing finds small blobs that moved in frame i but are not
 *    leftovers of frames i-1 or i+1 (removes the "ghost" of a moving object).
 * 2. track: links blobs across frames with a constant-velocity prediction and keeps the longest,
 *    smoothest chain: players and nets move too, but rarely along a ball-like path.
 * 3. analyse: finds the bounce (where downward image motion turns upward) and release (track start).
 */

export type Gray = { data: Uint8Array; w: number; h: number };

export type Candidate = { x: number; y: number; area: number; bw: number; bh: number; crowd?: number };

export type TrackPoint = { i: number; t: number; x: number; y: number; r: number; crowd: number };

export type DetectOptions = {
  /** Minimum brightness change (0–255) for a pixel to count as moving. */
  threshold: number;
  minArea: number;
  maxArea: number;
  maxCandidates: number;
};

export function defaultDetectOptions(w: number, h: number): DetectOptions {
  const px = w * h;
  return {
    threshold: 22,
    minArea: 3,
    maxArea: Math.max(60, Math.round(px * 0.004)),
    maxCandidates: 14,
  };
}

/** Converts RGBA pixels to grayscale (integer luma). */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number): Gray {
  const data = new Uint8Array(w * h);
  for (let p = 0, q = 0; p < data.length; p++, q += 4) {
    data[p] = (rgba[q] * 77 + rgba[q + 1] * 150 + rgba[q + 2] * 29) >> 8;
  }
  return { data, w, h };
}

/** Moving blobs in `cur`, using its neighbours `prev` and `next`. */
export function detect(prev: Gray, cur: Gray, next: Gray, opt: DetectOptions): Candidate[] {
  const { w, h } = cur;
  const n = w * h;
  const mask = new Uint8Array(n);
  const a = prev.data;
  const b = cur.data;
  const c = next.data;
  for (let p = 0; p < n; p++) {
    const d1 = Math.abs(b[p] - a[p]);
    const d2 = Math.abs(c[p] - b[p]);
    if (d1 > opt.threshold && d2 > opt.threshold) mask[p] = 1;
  }

  // Connected components (8-neighbour) with an explicit stack.
  const out: Candidate[] = [];
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (mask[start] !== 1) continue;
    let top = 0;
    stack[top++] = start;
    mask[start] = 2;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let minX = w;
    let maxX = 0;
    let minY = h;
    let maxY = 0;
    let overflow = false;
    while (top > 0) {
      const p = stack[--top];
      const x = p % w;
      const y = (p - x) / w;
      area++;
      sx += x;
      sy += y;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (area > opt.maxArea) overflow = true;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (mask[q] === 1) {
            mask[q] = 2;
            stack[top++] = q;
          }
        }
      }
    }
    if (overflow || area < opt.minArea) continue;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const long = Math.max(bw, bh);
    const short = Math.min(bw, bh);
    // A ball is compact; motion blur stretches it into a short streak, not a line.
    if (long > 4 * short + 3) continue;
    if (area / (bw * bh) < 0.25) continue;
    out.push({ x: sx / area, y: sy / area, area, bw, bh });
  }
  // Blobs crowded together are usually limbs, bats or clothing; a ball in flight is on its own.
  const crowdR2 = (Math.max(w, h) * 0.035) ** 2;
  for (const c of out) {
    c.crowd = 0;
    for (const d of out) if (d !== c && (d.x - c.x) ** 2 + (d.y - c.y) ** 2 < crowdR2) c.crowd++;
  }
  out.sort((p, q) => rank(q) - rank(p));
  return out.slice(0, opt.maxCandidates);
}

const rank = (c: Candidate) => compactness(c) - 0.15 * (c.crowd ?? 0);

const compactness = (c: Candidate) => c.area / Math.max(c.bw, c.bh) ** 2;

export type TrackOptions = {
  /** Smallest movement per frame (px) for a real ball; filters flicker. */
  minStep: number;
  /** Largest movement per frame (px). */
  maxStep: number;
  /** Frames a track may skip (missed detections). */
  maxGap: number;
  minPoints: number;
};

export function defaultTrackOptions(w: number, h: number): TrackOptions {
  const size = Math.max(w, h);
  return { minStep: 0.8, maxStep: size * 0.12, maxGap: 2, minPoints: 5 };
}

/**
 * Finds the most ball-like track. `times[i]` is frame i's timestamp in seconds; `cands[i]` its blobs.
 * `prefer(t)` optionally scores tracks by when they end (e.g. near the bat contact).
 */
export function track(
  cands: Candidate[][],
  times: number[],
  opt: TrackOptions,
  prefer?: (lastT: number) => number,
): TrackPoint[] {
  let best: TrackPoint[] = [];
  let bestScore = -Infinity;
  const used = new Set<string>();
  const pt = (i: number, c: Candidate): TrackPoint => ({
    i,
    t: times[i],
    x: c.x,
    y: c.y,
    r: Math.sqrt(c.area / Math.PI),
    crowd: c.crowd ?? 0,
  });

  for (let i = 0; i < cands.length - 1; i++) {
    for (const a of cands[i]) {
      for (let g = 1; g <= opt.maxGap + 1 && i + g < cands.length; g++) {
        for (const b of cands[i + g]) {
          const step = Math.hypot(b.x - a.x, b.y - a.y) / g;
          if (step < opt.minStep || step > opt.maxStep) continue;
          const key = `${i}:${a.x.toFixed(1)}:${a.y.toFixed(1)}>${i + g}:${b.x.toFixed(1)}`;
          if (used.has(key)) continue;
          const chain = extend([pt(i, a), pt(i + g, b)], cands, times, opt);
          for (let k = 1; k < chain.length; k++) {
            used.add(`${chain[k - 1].i}:${chain[k - 1].x.toFixed(1)}:${chain[k - 1].y.toFixed(1)}>${chain[k].i}:${chain[k].x.toFixed(1)}`);
          }
          if (chain.length < opt.minPoints) continue;
          const score = scoreTrack(chain) + (prefer ? prefer(chain[chain.length - 1].t) : 0);
          if (score > bestScore) {
            bestScore = score;
            best = chain;
          }
        }
      }
    }
  }
  return best;
}

function extend(chain: TrackPoint[], cands: Candidate[][], times: number[], opt: TrackOptions): TrackPoint[] {
  let gap = 0;
  let bounced = false;
  for (let i = chain[chain.length - 1].i + 1; i < cands.length; i++) {
    const last = chain[chain.length - 1];
    const prev = chain[chain.length - 2];
    const dtPrev = last.i - prev.i;
    const vx = (last.x - prev.x) / dtPrev;
    const vy = (last.y - prev.y) / dtPrev;
    const steps = i - last.i;
    const px = last.x + vx * steps;
    const py = last.y + vy * steps;
    const speed = Math.hypot(vx, vy);
    // Generous enough for the bounce, where the vertical motion reverses.
    const radius = 4 + 0.6 * speed * steps + (chain.length < 4 ? 0.4 * speed : 0);
    let pick: Candidate | null = null;
    let pickD = radius;
    for (const c of cands[i]) {
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < pickD) {
        pick = c;
        pickD = d;
      }
    }
    // Bounce: a ball moving down the image can suddenly move up, keeping its sideways motion.
    if (!pick && vy > 1 && !bounced) {
      const by = last.y - 0.5 * vy * steps;
      const bRadius = 4 + 0.6 * Math.abs(vx) * steps + 0.6 * vy * steps;
      for (const c of cands[i]) {
        if (c.y >= last.y + 1) continue; // must actually turn upward
        const d = Math.hypot(c.x - px, c.y - by);
        if (d < (pickD === radius ? bRadius : pickD)) {
          pick = c;
          pickD = d;
        }
      }
      if (pick) bounced = true;
    }
    if (pick) {
      const step = Math.hypot(pick.x - last.x, pick.y - last.y) / steps;
      if (step <= opt.maxStep) {
        chain.push({ i, t: times[i], x: pick.x, y: pick.y, r: Math.sqrt(pick.area / Math.PI), crowd: pick.crowd ?? 0 });
        gap = 0;
        continue;
      }
    }
    if (++gap > opt.maxGap) break;
  }
  return chain;
}

/** Longer and smoother is better; jittery chains of unrelated blobs score low. */
function scoreTrack(chain: TrackPoint[]): number {
  let jerk = 0;
  for (let k = 2; k < chain.length; k++) {
    const ax = chain[k].x - 2 * chain[k - 1].x + chain[k - 2].x;
    const ay = chain[k].y - 2 * chain[k - 1].y + chain[k - 2].y;
    jerk += Math.hypot(ax, ay);
  }
  let path = 0;
  for (let k = 1; k < chain.length; k++) path += Math.hypot(chain[k].x - chain[k - 1].x, chain[k].y - chain[k - 1].y);
  const span = chain[chain.length - 1].i - chain[0].i + 1;
  const fill = chain.length / span;
  // A ball keeps its sideways direction; chains that zig-zag across limbs do not.
  let reversals = 0;
  for (let k = 2; k < chain.length; k++) {
    const d1 = chain[k - 1].x - chain[k - 2].x;
    const d2 = chain[k].x - chain[k - 1].x;
    if (d1 * d2 < 0 && Math.abs(d1) > 1.5 && Math.abs(d2) > 1.5) reversals++;
  }
  const crowd = chain.reduce((a, p) => a + Math.min(p.crowd, 4), 0) / chain.length;
  return (
    chain.length * fill +
    Math.min(path, 400) / 40 -
    (jerk / Math.max(path, 1)) * chain.length -
    1.5 * reversals -
    1.2 * crowd * Math.sqrt(chain.length)
  );
}

/** Least-squares quadratic y = a + b t + c t² ; returns coefficients and squared error. */
function quadFit(ts: number[], ys: number[]): { a: number; b: number; c: number; sse: number } {
  const n = ts.length;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, y0 = 0, y1 = 0, y2 = 0;
  for (let k = 0; k < n; k++) {
    const t = ts[k];
    const t2 = t * t;
    s0 += 1; s1 += t; s2 += t2; s3 += t2 * t; s4 += t2 * t2;
    y0 += ys[k]; y1 += ys[k] * t; y2 += ys[k] * t2;
  }
  const det = (m: number[][]) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const M = [[s0, s1, s2], [s1, s2, s3], [s2, s3, s4]];
  const D = det(M);
  if (Math.abs(D) < 1e-12) return { a: y0 / n, b: 0, c: 0, sse: Infinity };
  const col = (j: number, v: number[]) => M.map((row, r) => row.map((x, cIdx) => (cIdx === j ? v[r] : x)));
  const v = [y0, y1, y2];
  const a = det(col(0, v)) / D;
  const b = det(col(1, v)) / D;
  const c = det(col(2, v)) / D;
  let sse = 0;
  for (let k = 0; k < n; k++) sse += (ys[k] - (a + b * ts[k] + c * ts[k] * ts[k])) ** 2;
  return { a, b, c, sse };
}

/**
 * Bounce: the split that best explains the vertical image motion as two parabolas, with the ball
 * moving down the image before and up after. Returns the bounce time and position, or null.
 */
export function findBounce(points: TrackPoint[]): { t: number; x: number; y: number; index: number } | null {
  if (points.length < 6) return null;
  const t0 = points[0].t;
  const ts = points.map((p) => p.t - t0);
  const ys = points.map((p) => p.y);
  const one = quadFit(ts, ys).sse;
  let best: { s: number; sse: number } | null = null;
  for (let s = 2; s <= points.length - 3; s++) {
    const before = quadFit(ts.slice(0, s + 1), ys.slice(0, s + 1));
    const after = quadFit(ts.slice(s), ys.slice(s));
    const vBefore = before.b + 2 * before.c * ts[s];
    const vAfter = after.b + 2 * after.c * ts[s];
    if (!(vBefore > 0 && vAfter < 0)) continue; // image y grows downwards
    const sse = before.sse + after.sse;
    if (!best || sse < best.sse) best = { s, sse };
  }
  if (!best) return null;
  // A bounce is a kink: two arcs must fit clearly better than one smooth arc (which also turns
  // upward at its peak). If one arc already fits to within pixel noise, there is no kink.
  if (one < points.length * 1.0 || best.sse > 0.5 * one) return null;
  const p = points[best.s];
  return { t: p.t, x: p.x, y: p.y, index: best.s };
}
