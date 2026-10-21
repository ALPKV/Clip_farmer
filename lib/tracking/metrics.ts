/**
 * Turns a ball track and a few timings into delivery estimates.
 *
 * Speed is timed, not measured from pixels: the ball covers a known distance between release
 * and bat contact (by default the bowler's popping crease to the batter's popping crease,
 * 20.12 m − 2 × 1.22 m = 17.68 m), so average speed = distance ÷ time. Bat contact comes from
 * the audio crack, which is precise to a few milliseconds; release comes from the start of the
 * track and is only as precise as one video frame. The result is an average over the flight
 * (the ball is faster at release), so treat it as an estimate.
 */

export const PITCH_M = 20.12;
export const CREASE_M = 1.22;
export const STUMPS_WIDTH_M = 0.2286;
export const CREASE_TO_CREASE_M = PITCH_M - 2 * CREASE_M;

export type Timing = {
  /** Seconds (video time). */
  release: number | null;
  bounce: number | null;
  contact: number | null;
};

export type Setup = {
  /** Distance the ball travels between release and contact, in metres. */
  distanceM: number;
  /** Camera distance behind the bowler's stumps, in metres (for line estimates). */
  cameraBehindM: number;
};

export const DEFAULT_SETUP: Setup = { distanceM: CREASE_TO_CREASE_M, cameraBehindM: 1 };

/** Average speed release→contact in km/h, or null. */
export function speedKmh(t: Timing, setup: Setup): number | null {
  if (t.release == null || t.contact == null) return null;
  const dt = t.contact - t.release;
  if (dt <= 0.12 || dt > 2.5) return null; // outside anything a bowler or machine can produce
  const kmh = (setup.distanceM / dt) * 3.6;
  return kmh >= 15 && kmh <= 180 ? kmh : null;
}

/**
 * Pitch length in metres from the batter's stumps. Assumes roughly constant horizontal speed
 * from release to the bounce, then counts that distance from the release point.
 */
export function lengthM(t: Timing, setup: Setup): number | null {
  const kmh = speedKmh(t, setup);
  if (kmh == null || t.bounce == null || t.release == null) return null;
  if (t.bounce <= t.release || (t.contact != null && t.bounce >= t.contact)) return null;
  const releaseFromStumps = setup.distanceM + CREASE_M; // the release is `distanceM` from the batter's crease
  const travelled = (kmh / 3.6) * (t.bounce - t.release);
  return Math.min(PITCH_M, Math.max(0, releaseFromStumps - travelled));
}

/**
 * Line in cm left (−) or right (+) of the middle stump as seen from the camera.
 * Needs the base of the off and leg stumps marked in the image, and a camera placed behind the
 * bowler's stumps on the pitch line.
 */
export function lineCm(
  bounceX: number,
  stumps: { leftX: number; rightX: number },
  length: number,
  setup: Setup,
): number | null {
  const widthPx = Math.abs(stumps.rightX - stumps.leftX);
  if (widthPx <= 0.002) return null; // coordinates are fractions of the frame width
  const midX = (stumps.leftX + stumps.rightX) / 2;
  const zStumps = setup.cameraBehindM + PITCH_M;
  const zBounce = zStumps - length;
  if (zBounce <= 0.5) return null;
  const metres = ((bounceX - midX) / widthPx) * STUMPS_WIDTH_M * (zBounce / zStumps);
  return metres * 100;
}
