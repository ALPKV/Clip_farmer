/**
 * Scores delivery finding against hand-labelled sessions (see README.md).
 *   node --experimental-strip-types scripts/deliveries/eval.mts <dir>
 * <dir> holds, per session in labels.json, <name>.s16 (16 kHz mono 16-bit audio) and
 * <name>_motion.json ({ t, m }: fraction of a 90×160 picture that changed, 10 times a second).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { findImpacts, groupDeliveries } from "../../lib/tracking/hits.ts";
import { combineDeliveries, motionPeaks } from "../../lib/tracking/deliveries.ts";

const dir = process.argv[2];
const labels: Record<string, { releases: number[] }> = JSON.parse(
  readFileSync(new URL("./labels.json", import.meta.url), "utf8"),
);

// A delivery counts as found when a clip is anchored between just before release and the ball
// reaching the batter (plus the net sound): [release − 0.8 s, release + 2.6 s]. Each delivery can
// be found once; a second clip of the same ball counts as a duplicate.
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
  const fp = found.length - tp - dup;
  return `${tp}/${releases.length} found, ${dup} duplicate, ${fp} false`;
}

for (const [name, { releases }] of Object.entries(labels)) {
  const buf = readFileSync(join(dir, `${name}.s16`));
  const pcm = new Int16Array(buf.buffer, buf.byteOffset, buf.byteLength >> 1);
  const sounds = groupDeliveries(await findImpacts(pcm, 16000));
  const motionFile = join(dir, `${name}_motion.json`);
  const peaks = existsSync(motionFile) ? motionPeaks(JSON.parse(readFileSync(motionFile, "utf8"))) : null;
  for (const thr of [-10, -25, -32]) {
    console.log(name, `sound > ${thr} dB:`, score(sounds.filter((s) => s.rel > thr).map((s) => s.contact), releases));
  }
  if (peaks) console.log(name, "sound > -25 dB + bowling actions:", score(combineDeliveries(sounds, peaks, -25).map((d) => d.t), releases));
}
