// Pseudo-labels ball candidates: blobs on long, smooth tracks are "ball", other moving blobs are "not ball".
import { openSync, readSync, writeFileSync, statSync } from "node:fs";
import * as T from "../../lib/tracking/core.ts";

const [file, name, fps] = [process.argv[2], process.argv[3], +process.argv[4]];
const W = 360, H = 640, N = W * H;
const nFrames = statSync(file).size / N;
const fd = openSync(file, "r");
const frame = (i: number): T.Gray => {
  const data = new Uint8Array(N);
  readSync(fd, data, 0, N, i * N);
  return { data, w: W, h: H };
};

const P = 9; // patch size
const R = (P - 1) / 2;
type Cand = T.Candidate & { i: number; feat: number[] };

function features(prev: T.Gray, cur: T.Gray, next: T.Gray, c: T.Candidate): number[] {
  const cx = Math.round(c.x), cy = Math.round(c.y);
  const patch: number[] = [];
  const motion: number[] = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const x = Math.min(W - 1, Math.max(0, cx + dx)), y = Math.min(H - 1, Math.max(0, cy + dy));
    const p = y * W + x;
    patch.push(cur.data[p]);
    motion.push(Math.min(Math.abs(cur.data[p] - prev.data[p]), Math.abs(next.data[p] - cur.data[p])));
  }
  const norm = (v: number[]) => { const m = v.reduce((a, b) => a + b, 0) / v.length; const s = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1; return v.map((x) => (x - m) / s); };
  const meanI = patch.reduce((a, b) => a + b, 0) / patch.length / 255;
  const meanM = motion.reduce((a, b) => a + b, 0) / motion.length / 255;
  const long = Math.max(c.bw, c.bh), short = Math.min(c.bw, c.bh);
  return [
    Math.log(c.area), long / short, c.area / (c.bw * c.bh), Math.min(c.crowd ?? 0, 6) / 6, meanI, meanM,
    ...norm(patch), ...motion.map((m) => m / 255),
  ];
}

const dopt = { ...T.defaultDetectOptions(W, H), maxCandidates: 20 };
const topt = T.defaultTrackOptions(W, H);
const cands: Cand[][] = [];
const times: number[] = [];
let prev = frame(0), cur = frame(1);
cands.push([]); times.push(0);
for (let i = 1; i < nFrames - 1; i++) {
  const next = frame(i + 1);
  cands.push(T.detect(prev, cur, next, dopt).map((c) => ({ ...c, i, feat: features(prev, cur, next, c) })));
  times.push(i / fps);
  prev = cur; cur = next;
}
cands.push([]); times.push((nFrames - 1) / fps);

// Sliding windows: the best track in each window marks ball blobs.
const pos = new Map<string, number>();
const trackList: { pts: { i: number; x: number; y: number }[] }[] = [];
const key = (i: number, x: number, y: number) => `${i}:${x.toFixed(1)}:${y.toFixed(1)}`;
const WIN = Math.round(fps * 1.6), STEP = Math.round(fps * 0.4);
let tracks = 0;
for (let s = 0; s + WIN < cands.length; s += STEP) {
  const sub = cands.slice(s, s + WIN);
  const pts = T.track(sub, times.slice(s, s + WIN), topt);
  if (pts.length < 7) continue;
  let path = 0, reversals = 0;
  for (let k = 1; k < pts.length; k++) path += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y);
  for (let k = 2; k < pts.length; k++) { const d1 = pts[k - 1].x - pts[k - 2].x, d2 = pts[k].x - pts[k - 1].x; if (d1 * d2 < 0 && Math.abs(d1) > 1.5 && Math.abs(d2) > 1.5) reversals++; }
  const crowd = pts.reduce((a, p) => a + p.crowd, 0) / pts.length;
  if (path < 40 || reversals > 1 || crowd > 1.5) continue;
  tracks++;
  const id = trackList.length;
  trackList.push({ pts: pts.map((p) => ({ i: p.i + s, x: Math.round(p.x), y: Math.round(p.y) })) });
  for (const p of pts) if (!pos.has(key(p.i + s, p.x, p.y))) pos.set(key(p.i + s, p.x, p.y), id);
}

const rows: { v: string; i: number; x: number; y: number; label: number; track: number }[] = [];
const feats: number[] = [];
for (const fc of cands) for (const c of fc) {
  const tid = pos.get(key(c.i, c.x, c.y));
  rows.push({ v: name, i: c.i, x: c.x, y: c.y, label: tid === undefined ? 0 : 1, track: tid ?? -1 });
  feats.push(...c.feat);
}
const dim = cands.find((f) => f.length)![0].feat.length;
writeFileSync(`${file}.feat.bin`, Buffer.from(new Float32Array(feats).buffer));
writeFileSync(`${file}.meta.json`, JSON.stringify({ dim, rows, tracks: trackList }));
console.log(name, "frames", nFrames, "candidates", rows.length, "ball", rows.filter((r) => r.label).length, "tracks", tracks, "dim", dim);
