/**
 * Bat-contact detection from the audio track (the method from the original Streamlit app, ported from
 * librosa): a hit is an RMS loudness peak above `sensitivity`, at least `minGapSec` after the
 * previous one. Each hit is then refined to the sharpest transient nearby, which pins the
 * contact to within a few milliseconds.
 */

export type Hit = { time: number; level: number };

export function detectHits(
  pcm: Float32Array,
  sampleRate: number,
  sensitivity: number,
  minGapSec = 3,
): Hit[] {
  const frame = Math.round(sampleRate * 0.0464); // librosa default: 2048 samples at 44.1 kHz
  const hop = Math.round(frame / 4);
  const hits: Hit[] = [];
  for (let start = 0; start + frame <= pcm.length; start += hop) {
    let sum = 0;
    for (let k = start; k < start + frame; k++) sum += pcm[k] * pcm[k];
    const rms = Math.sqrt(sum / frame);
    if (rms <= sensitivity) continue;
    const t = start / sampleRate;
    const last = hits[hits.length - 1];
    if (last && t - last.time <= minGapSec) {
      // Same event: keep the loudest frame of it.
      if (rms > last.level && t - last.time < 0.25) {
        last.time = t;
        last.level = rms;
      }
      continue;
    }
    hits.push({ time: t, level: rms });
  }
  return hits.map((h) => ({ ...h, time: refineContact(pcm, sampleRate, h.time + frame / 2 / sampleRate) }));
}

/** Time of the largest sample-to-sample jump within ±80 ms: the crack of bat on ball. */
export function refineContact(pcm: Float32Array, sampleRate: number, around: number): number {
  const lo = Math.max(1, Math.floor((around - 0.08) * sampleRate));
  const hi = Math.min(pcm.length - 1, Math.ceil((around + 0.08) * sampleRate));
  let best = lo;
  let bestJump = -1;
  for (let k = lo; k < hi; k++) {
    const jump = Math.abs(pcm[k] - pcm[k - 1]);
    if (jump > bestJump) {
      bestJump = jump;
      best = k;
    }
  }
  return best / sampleRate;
}
