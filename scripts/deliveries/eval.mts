/**
 * Scores shot finding against hand-labelled sessions (see README.md).
 *   node --experimental-strip-types scripts/deliveries/eval.mts <dir>
 * <dir> holds, per session in labels.json, <name>.s16 (16 kHz mono 16-bit audio).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findImpacts, isSpeech, pickShots, refineContact } from "../../lib/tracking/hits.ts";

const dir = process.argv[2];
const labels: Record<string, { releases: number[] }> = JSON.parse(readFileSync(new URL("./labels.json", import.meta.url), "utf8"));

// A delivery counts as found when a clip lands between just before its release and the ball
// reaching the batter (plus the net sound): [release − 0.8 s, release + 2.6 s]. Each delivery can
// be found once; a second clip of the same ball is a duplicate.
function score(found: number[], releases: number[]) {
  const ok = (f: number, r: number) => f >= r - 0.8 && f <= r + 2.6;
  const taken = new Set<number>();
  let tp = 0;
  let dup = 0;
  for (const f of found) {
    const r = releases.findIndex((r, i) => !taken.has(i) && ok(f, r));
    if (r >= 0) {
      taken.add(r);
      tp++;
    } else if (releases.some((r) => ok(f, r))) dup++;
  }
  return `${tp}/${releases.length} found, ${dup} duplicate, ${found.length - tp - dup} false`;
}

for (const [name, { releases }] of Object.entries(labels)) {
  const buf = readFileSync(join(dir, `${name}.s16`));
  const pcm = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength >> 1);
  const sounds = (await findImpacts(pcm, 16000))
    .filter((e) => e.riseDb > 10 && !isSpeech(e))
    .map((e) => ({ t: refineContact(pcm, 16000, e.t), levelDb: e.levelDb }));
  for (const gap of [2, 3]) {
    for (const thr of [-15, -25]) console.log(name, `sensitivity ${thr} dB, skip ${gap} s:`, score(pickShots(sounds, thr, gap).map((s) => s.t), releases));
  }
}
