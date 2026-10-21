import assert from "node:assert/strict";
import { test } from "node:test";
import { detect, defaultDetectOptions, defaultTrackOptions, findBounce, track, type Gray, type TrackPoint } from "../lib/tracking/core.ts";
import { detectHits } from "../lib/tracking/hits.ts";
import { CREASE_TO_CREASE_M, DEFAULT_SETUP, lengthM, lineCm, speedKmh } from "../lib/tracking/metrics.ts";

test("speed is distance over release-to-contact time", () => {
  // 17.68 m in 0.5 s = 35.36 m/s = 127.3 km/h
  const kmh = speedKmh({ release: 1.0, bounce: null, contact: 1.5 }, DEFAULT_SETUP)!;
  assert.ok(Math.abs(kmh - (CREASE_TO_CREASE_M / 0.5) * 3.6) < 1e-9);
  assert.equal(speedKmh({ release: 1.0, bounce: null, contact: 1.05 }, DEFAULT_SETUP), null); // impossible
  assert.equal(speedKmh({ release: null, bounce: null, contact: 1.5 }, DEFAULT_SETUP), null);
});

test("length counts the distance travelled before the bounce", () => {
  // Release 18.90 m from the stumps; at 35.36 m/s for 0.35 s the ball travels 12.38 m → 6.52 m.
  const len = lengthM({ release: 1.0, bounce: 1.35, contact: 1.5 }, DEFAULT_SETUP)!;
  assert.ok(Math.abs(len - (18.9 - (CREASE_TO_CREASE_M / 0.5) * 0.35)) < 1e-6);
});

test("line scales the stumps width by depth", () => {
  // Bounce exactly one stump-width right of middle, at the stumps' depth → 22.86 cm.
  const cm = lineCm(0.6, { leftX: 0.45, rightX: 0.55 }, 0, DEFAULT_SETUP)!;
  assert.ok(Math.abs(cm - 22.86) < 1e-6);
});

function blank(w: number, h: number, v = 40): Gray {
  return { data: new Uint8Array(w * h).fill(v), w, h };
}
function dot(g: Gray, cx: number, cy: number, r: number) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++)
    for (let x = Math.floor(cx - r); x <= cx + r; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= 0 && y >= 0 && x < g.w && y < g.h) g.data[y * g.w + x] = 230;
}

test("tracks a synthetic ball with a bounce and finds the bounce", () => {
  const w = 200;
  const h = 300;
  const n = 24;
  const bounceAt = 14;
  // Moves right steadily; falls down the image until frame 14, then rises.
  const path = Array.from({ length: n }, (_, i) => ({
    x: 20 + i * 7,
    y: i <= bounceAt ? 60 + 0.9 * i * i : 60 + 0.9 * bounceAt * bounceAt - 9 * (i - bounceAt),
  }));
  const frames = path.map((p) => {
    const g = blank(w, h);
    dot(g, p.x, p.y, 3);
    return g;
  });
  // A distracting flicker that never moves along a path.
  frames.forEach((g, i) => i % 3 === 0 && dot(g, 150, 40, 3));
  const times = path.map((_, i) => i / 60);
  const dopt = defaultDetectOptions(w, h);
  const cands = frames.map((f, i) => (i === 0 || i === n - 1 ? [] : detect(frames[i - 1], f, frames[i + 1], dopt)));
  const pts: TrackPoint[] = track(cands, times, defaultTrackOptions(w, h));
  assert.ok(pts.length >= n - 4, `track too short: ${pts.length}`);
  for (const p of pts) assert.ok(Math.abs(p.x - path[p.i].x) < 1.5 && Math.abs(p.y - path[p.i].y) < 1.5);
  const b = findBounce(pts);
  assert.ok(b, "bounce not found");
  assert.ok(Math.abs(b.t - times[bounceAt]) <= 1.01 / 60, `bounce at ${b.t}`);
});

test("finds bat contacts in audio and pins them to the transient", () => {
  const sr = 8000;
  const pcm = new Float32Array(sr * 10);
  for (let k = 0; k < pcm.length; k++) pcm[k] = (Math.sin(k * 0.3) * 0.01);
  for (const t of [2.0, 6.5]) {
    const at = Math.round(t * sr);
    for (let k = 0; k < 400; k++) pcm[at + k] = (k % 2 ? -1 : 1) * 0.8 * Math.exp(-k / 120);
  }
  const hits = detectHits(pcm, sr, 0.15, 3);
  assert.equal(hits.length, 2);
  assert.ok(Math.abs(hits[0].time - 2.0) < 0.005, `first at ${hits[0].time}`);
  assert.ok(Math.abs(hits[1].time - 6.5) < 0.005, `second at ${hits[1].time}`);
});
