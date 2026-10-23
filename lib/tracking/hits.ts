/**
 * Finding shots from the sound track. A bat hitting the ball is a sharp, bright click: high-frequency
 * energy that jumps far above the room's background in a few milliseconds. So instead of a fixed
 * loudness level this looks for sudden jumps in the 1.5–7.5 kHz band compared with the previous
 * 3 seconds, which works in a quiet net or a loud hall. Talking is ignored (a "t" or "k" clicks too,
 * but a vowel follows it). Then the rule is simple: a sound over the threshold makes a clip, and any
 * sound within the gap after it is skipped.
 */

export type Impact = {
  /** Seconds. */
  t: number;
  /** How far above the background the onset is, in robust standard deviations. */
  z: number;
  /** Rise over the previous 150 ms, in dB. */
  riseDb: number;
  /** Loudness of the high band at the peak, in dB. */
  levelDb: number;
  /** log10 of high-band over low-band energy: above 0 is a bright crack, well below is a dull thud. */
  hiLo: number;
  /**
   * How voiced the 150 ms after the sound is (0–1). A vowel repeats 80–400 times a second, so speech
   * scores high; a bat crack dies away into silence or net noise. Compared with `voiceBefore`, so a
   * steady hum (a bowling machine) doesn't count.
   */
  voice: number;
  /** The same measure for the moment just before the sound. */
  voiceBefore: number;
};

/** Normalised autocorrelation peak over pitch periods of 80–400 Hz, on 8 kHz samples. */
function voicing(pcm: Int16Array | Float32Array, sampleRate: number, from: number, to: number): number {
  const step = Math.max(1, Math.round(sampleRate / 8000));
  const a = Math.max(0, Math.round(from * sampleRate));
  const b = Math.min(pcm.length, Math.round(to * sampleRate));
  const x: number[] = [];
  for (let i = a; i < b; i += step) x.push(pcm[i]);
  const sr = sampleRate / step;
  let best = 0;
  for (let lag = Math.floor(sr / 400); lag <= Math.ceil(sr / 80) && lag < x.length / 2; lag++) {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let i = 0; i + lag < x.length; i++) {
      xy += x[i] * x[i + lag];
      xx += x[i] * x[i];
      yy += x[i + lag] * x[i + lag];
    }
    if (xx > 0 && yy > 0) best = Math.max(best, xy / Math.sqrt(xx * yy));
  }
  return best;
}

/**
 * Talking, not a cricket impact: strongly voiced afterwards, and much more than just before. Set
 * between the talking found in the labelled sessions (0.79, +0.41) and the most voiced real
 * delivery (0.65, +0.22).
 */
export const isSpeech = (e: Impact) => e.voice > SPEECH_VOICE && e.voice - e.voiceBefore > SPEECH_RISE;
export const SPEECH_VOICE = 0.6;
export const SPEECH_RISE = 0.3;

/** A candidate shot: an impact that isn't talking, at its exact click. */
export type Sound = { t: number; levelDb: number };

const N = 512;
const HOP = 128;

/** In-place radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array, cos: Float64Array, sin: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const step = n / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = cos[k * step];
        const wi = -sin[k * step];
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * wr - im[b] * wi;
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }
}

function median(values: Float64Array | number[]): number {
  const s = Float64Array.from(values).sort();
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const pause = () => new Promise((r) => setTimeout(r, 0));

/**
 * Every candidate impact in the recording. `pcm` is mono, 16-bit integers or floats in [-1, 1].
 * Gives the browser a breather every few thousand frames so long sessions don't freeze the page.
 */
export async function findImpacts(
  pcm: Int16Array | Float32Array,
  sampleRate: number,
  onProgress?: (fraction: number) => void,
): Promise<Impact[]> {
  const scale = pcm instanceof Int16Array ? 1 / 32768 : 1;
  const frames = Math.max(0, Math.floor((pcm.length - N) / HOP) + 1);
  const fps = sampleRate / HOP;
  const bin = (hz: number) => Math.round((hz * N) / sampleRate);
  const [hiLoBin, hiHiBin] = [bin(1500), Math.min(N / 2, bin(7500))];
  const [loLoBin, loHiBin] = [Math.max(1, bin(100)), bin(800)];
  const win = new Float64Array(N);
  for (let k = 0; k < N; k++) win[k] = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / N);
  const winSum = win.reduce((a, b) => a + b, 0);
  const cos = new Float64Array(N / 2);
  const sin = new Float64Array(N / 2);
  for (let k = 0; k < N / 2; k++) {
    cos[k] = Math.cos((2 * Math.PI * k) / N);
    sin[k] = Math.sin((2 * Math.PI * k) / N);
  }

  const flux = new Float64Array(frames);
  const hi = new Float64Array(frames);
  const lo = new Float64Array(frames);
  const bandSize = hiHiBin - hiLoBin + 1;
  let prevLog = new Float64Array(bandSize);
  let curLog = new Float64Array(bandSize);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let f = 0; f < frames; f++) {
    const off = f * HOP;
    for (let k = 0; k < N; k++) {
      re[k] = pcm[off + k] * scale * win[k];
      im[k] = 0;
    }
    fft(re, im, cos, sin);
    let fl = 0;
    let h = 0;
    for (let k = hiLoBin; k <= hiHiBin; k++) {
      const mag = Math.hypot(re[k], im[k]) / winSum;
      h += mag;
      const l = Math.log1p(1000 * mag);
      curLog[k - hiLoBin] = l;
      if (f > 0) fl += Math.max(0, l - prevLog[k - hiLoBin]);
    }
    let lsum = 0;
    for (let k = loLoBin; k <= loHiBin; k++) lsum += Math.hypot(re[k], im[k]) / winSum;
    flux[f] = fl / bandSize;
    hi[f] = h;
    lo[f] = lsum;
    [prevLog, curLog] = [curLog, prevLog];
    if (f % 4000 === 3999) {
      onProgress?.((f / frames) * 0.9);
      await pause();
    }
  }

  // Background level: median and median absolute deviation over 3 s, updated every quarter second.
  const half = Math.round(1.5 * fps);
  const block = Math.max(1, Math.round(0.25 * fps));
  const z = new Float64Array(frames);
  for (let b0 = 0; b0 < frames; b0 += block) {
    const lo0 = Math.max(0, b0 + (block >> 1) - half);
    const hi0 = Math.min(frames, b0 + (block >> 1) + half + 1);
    const w = flux.subarray(lo0, hi0);
    const med = median(w);
    const mad = median(Array.from(w, (v) => Math.abs(v - med))) + 1e-6;
    for (let f = b0; f < Math.min(frames, b0 + block); f++) z[f] = (flux[f] - med) / mad;
  }

  // Peaks: well above the background, the highest point within ±30 ms, at least 120 ms apart.
  const near = Math.max(1, Math.round(0.03 * fps));
  const refractory = Math.round(0.12 * fps);
  const peaks: number[] = [];
  for (let f = 1; f < frames; f++) {
    if (z[f] <= 4) continue;
    let isMax = true;
    for (let g = Math.max(0, f - near); g <= Math.min(frames - 1, f + near) && isMax; g++) if (flux[g] > flux[f]) isMax = false;
    if (!isMax) continue;
    const last = peaks[peaks.length - 1];
    if (last != null && f - last < refractory) {
      if (z[f] > z[last]) peaks[peaks.length - 1] = f;
      continue;
    }
    peaks.push(f);
  }

  const pre = Math.round(0.15 * fps);
  const out: Impact[] = [];
  for (const f of peaks) {
    let before = 0;
    let count = 0;
    for (let g = Math.max(0, f - pre); g < Math.max(1, f - 1); g++, count++) before += hi[g];
    before = before / Math.max(1, count) + 1e-9;
    let peak = 0;
    let low = 0;
    for (let g = f; g < Math.min(frames, f + 3); g++) {
      peak = Math.max(peak, hi[g]);
      low = Math.max(low, lo[g]);
    }
    const t = (f * HOP + N / 2) / sampleRate;
    const voicedAfter = voicing(pcm, sampleRate, t + 0.03, t + 0.18);
    const voicedBefore = voicing(pcm, sampleRate, t - 0.2, t - 0.05);
    out.push({
      t,
      voice: voicedAfter,
      voiceBefore: voicedBefore,
      z: z[f],
      riseDb: 20 * Math.log10(peak / before),
      levelDb: 20 * Math.log10(peak + 1e-9),
      hiLo: Math.log10((peak + 1e-9) / (low + 1e-9)),
    });
  }
  onProgress?.(1);
  return out;
}

/**
 * The shots: every sound within `thresholdDb` of the session's big hits (its 90th-percentile
 * loudness), skipping anything within `gapSec` after a kept one. Of sounds less than 0.4 s apart the
 * loudest is kept, so a footstep just before the crack doesn't take its place.
 */
export function pickShots(sounds: Sound[], thresholdDb: number, gapSec: number): { t: number; rel: number }[] {
  if (sounds.length === 0) return [];
  const levels = sounds.map((s) => s.levelDb).sort((a, b) => a - b);
  const ref = levels[Math.min(levels.length - 1, Math.floor(0.9 * (levels.length - 1) + 0.5))];
  const loud = sounds.filter((s) => s.levelDb - ref > thresholdDb).sort((a, b) => a.t - b.t);
  const out: { t: number; rel: number }[] = [];
  let last = -Infinity;
  for (let i = 0; i < loud.length; i++) {
    if (loud[i].t - last < gapSec) continue;
    let best = loud[i];
    for (let j = i + 1; j < loud.length && loud[j].t - loud[i].t < 0.4; j++) if (loud[j].levelDb > best.levelDb) best = loud[j];
    out.push({ t: best.t, rel: best.levelDb - ref });
    last = best.t;
  }
  return out;
}

/** Time of the largest sample-to-sample jump within ±`window` s: the crack of bat on ball. */
export function refineContact(pcm: ArrayLike<number>, sampleRate: number, around: number, window = 0.04): number {
  const lo = Math.max(1, Math.floor((around - window) * sampleRate));
  const hi = Math.min(pcm.length - 1, Math.ceil((around + window) * sampleRate));
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
