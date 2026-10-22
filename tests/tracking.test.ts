import assert from "node:assert/strict";
import { test } from "node:test";
import { detect, defaultDetectOptions, defaultTrackOptions, findBounce, track, type Gray, type TrackPoint } from "../lib/tracking/core.ts";
import { analyzeFrames } from "../lib/tracking/analyze.ts";
import { combineDeliveries, motionPeaks } from "../lib/tracking/deliveries.ts";
import { FEATURE_COUNT } from "../lib/tracking/model.ts";
import { findImpacts, groupDeliveries, isSpeech, refineContact } from "../lib/tracking/hits.ts";
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

test("collects model features for the tracked path, only when asked", () => {
  const w = 200;
  const h = 300;
  const n = 20;
  const frames = Array.from({ length: n }, (_, i) => {
    const g = blank(w, h);
    dot(g, 20 + i * 8, 60 + i * 9, 3);
    return g;
  });
  const times = frames.map((_, i) => i / 60);
  assert.equal(analyzeFrames(frames, times, null, { useModel: false }).training, null);
  const a = analyzeFrames(frames, times, null, { useModel: false, collect: true });
  assert.ok(a.training && a.training.track.length >= 10, `only ${a.training?.track.length} track samples`);
  for (const f of a.training!.track) assert.equal(f.length, FEATURE_COUNT);
});

test("finds every shot, even two seconds apart, and folds the net thud into its shot", async () => {
  const sr = 16000;
  const pcm = new Float32Array(sr * 8);
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  for (let k = 0; k < pcm.length; k++) pcm[k] = noise() * 0.003;
  const crack = (t: number, amp: number) => {
    const at = Math.round(t * sr);
    for (let k = 0; k < 400; k++) pcm[at + k] += noise() * amp * Math.exp(-k / 60);
  };
  const thud = (t: number) => {
    const at = Math.round(t * sr);
    for (let k = 0; k < 2000; k++) pcm[at + k] += Math.sin((2 * Math.PI * 180 * k) / sr) * 0.5 * Math.exp(-k / 600);
  };
  crack(2.0, 0.8);
  thud(2.9); // ball into the net
  crack(4.0, 0.2); // a softer shot straight after
  const sounds = groupDeliveries(await findImpacts(pcm, sr)).filter((d) => d.rel > -25);
  assert.equal(sounds.length, 2, JSON.stringify(sounds));
  const contacts = sounds.map((d) => refineContact(pcm, sr, d.contact));
  assert.ok(Math.abs(contacts[0] - 2.0) < 0.01, `first at ${contacts[0]}`);
  assert.ok(Math.abs(contacts[1] - 4.0) < 0.01, `second at ${contacts[1]}`);
});

test("ignores talking: a 't' or 'k' followed by a vowel is not a shot", async () => {
  const sr = 16000;
  const pcm = new Float32Array(sr * 6);
  let seed = 3;
  const noise = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
  for (let k = 0; k < pcm.length; k++) pcm[k] = noise() * 0.003;
  // A spoken "ta": a short click, then 250 ms of a vowel at 140 Hz (harmonics shaped like a voice).
  const syl = Math.round(2.0 * sr);
  for (let k = 0; k < 160; k++) pcm[syl + k] += noise() * 0.7 * Math.exp(-k / 50);
  for (let k = 160; k < 160 + 0.25 * sr; k++) {
    let v = 0;
    for (let hNo = 1; hNo <= 25; hNo++) v += Math.sin((2 * Math.PI * 140 * hNo * k) / sr) / hNo;
    pcm[syl + k] += 0.25 * v * Math.min(1, (k - 160) / 160);
  }
  // A real crack later on.
  const at = Math.round(4.0 * sr);
  for (let k = 0; k < 400; k++) pcm[at + k] += noise() * 0.8 * Math.exp(-k / 60);
  const impacts = await findImpacts(pcm, sr);
  assert.ok(impacts.some((e) => Math.abs(e.t - 2.0) < 0.05 && isSpeech(e)), "the syllable should be flagged as speech");
  const sounds = groupDeliveries(impacts).filter((d) => d.rel > -25);
  assert.deepEqual(sounds.map((d) => Math.round(d.contact)), [4]);
});

test("adds balls with no bat sound from bowling actions", () => {
  const t: number[] = [];
  const m: number[] = [];
  for (let k = 0; k < 200; k++) {
    t.push(k / 10);
    m.push(0.01 + (Math.abs(k / 10 - 5) < 0.3 || Math.abs(k / 10 - 12) < 0.3 ? 0.15 : 0));
  }
  const peaks = motionPeaks({ t, m });
  assert.deepEqual(peaks.map((p) => Math.round(p.t)), [5, 12]);
  // The bowler at 5 s is followed by a bat sound; the one at 12 s is not.
  const out = combineDeliveries([{ contact: 6.0, levelDb: -3, rel: 0 }], peaks, -25);
  assert.deepEqual(out.map((d) => [d.kind, Math.round(d.t * 10) / 10]), [["bat", 6], ["no-sound", 12.9]]);
});
