import assert from "node:assert/strict";
import { test } from "node:test";
import { detect, defaultDetectOptions, defaultTrackOptions, findBounce, track, type Gray, type TrackPoint } from "../lib/tracking/core.ts";
import { clipWindows } from "../lib/tracking/deliveries.ts";
import { findImpacts, isSpeech, pickShots, refineContact, type Sound } from "../lib/tracking/hits.ts";
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

/** What the app does after reading the sound: sharp, non-talking sounds at their exact click. */
async function soundsOf(pcm: Float32Array, sr: number): Promise<Sound[]> {
  return (await findImpacts(pcm, sr)).filter((e) => e.riseDb > 10 && !isSpeech(e)).map((e) => ({ t: refineContact(pcm, sr, e.t), levelDb: e.levelDb }));
}

function noisy(seconds: number, sr: number) {
  const pcm = new Float32Array(sr * seconds);
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  for (let k = 0; k < pcm.length; k++) pcm[k] = noise() * 0.003;
  const crack = (t: number, amp: number) => {
    const at = Math.round(t * sr);
    for (let k = 0; k < 400; k++) pcm[at + k] += noise() * amp * Math.exp(-k / 60);
  };
  return { pcm, crack, noise };
}

test("a sound over the threshold makes a clip; sounds within the gap after it are skipped", async () => {
  const sr = 16000;
  const { pcm, crack } = noisy(9, sr);
  crack(2.0, 0.8);
  crack(3.5, 0.5); // the ball hitting the net 1.5 s later: inside the 3 s gap
  crack(6.0, 0.3); // the next ball
  const shots = pickShots(await soundsOf(pcm, sr), -25, 3);
  assert.deepEqual(shots.map((s) => Math.round(s.t * 10) / 10), [2, 6]);
  // A shorter gap keeps the second sound too.
  assert.equal(pickShots(await soundsOf(pcm, sr), -25, 1).length, 3);
});

test("ignores talking: a 't' or 'k' followed by a vowel is not a shot", async () => {
  const sr = 16000;
  const { pcm, crack, noise } = noisy(6, sr);
  // A spoken "ta": a short click, then 250 ms of a vowel at 140 Hz (harmonics shaped like a voice).
  const syl = Math.round(2.0 * sr);
  for (let k = 0; k < 160; k++) pcm[syl + k] += noise() * 0.7 * Math.exp(-k / 50);
  for (let k = 160; k < 160 + 0.25 * sr; k++) {
    let v = 0;
    for (let h = 1; h <= 25; h++) v += Math.sin((2 * Math.PI * 140 * h * k) / sr) / h;
    pcm[syl + k] += 0.25 * v * Math.min(1, (k - 160) / 160);
  }
  crack(4.0, 0.8);
  const impacts = await findImpacts(pcm, sr);
  assert.ok(impacts.some((e) => Math.abs(e.t - 2.0) < 0.05 && isSpeech(e)), "the syllable should be flagged as speech");
  assert.deepEqual(pickShots(await soundsOf(pcm, sr), -25, 3).map((s) => Math.round(s.t)), [4]);
});

test("balls close together each keep their own clip", () => {
  const ball = (t: number) => ({ t, rel: 0 });
  const w = clipWindows([ball(10), ball(11.5), ball(13)], 1, 2.5);
  assert.equal(w.length, 3);
  for (const { delivery, start, end } of w) assert.ok(start < delivery.t && end > delivery.t, `clip ${start}-${end} misses ${delivery.t}`);
  for (let k = 1; k < w.length; k++) assert.ok(w[k].start >= w[k - 1].end, "clips overlap");
  // Removing the middle one (Not a shot) gives its neighbours their full length back.
  assert.deepEqual(clipWindows([ball(10), ball(13)], 1, 2.5).map((c) => [c.start, c.end]), [[9, 11.5], [12, 14.5]]);
});
