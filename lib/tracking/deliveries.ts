/** A shot found from the sound: bat contact time and loudness against the session's big hits (dB). */
export type Delivery = { t: number; rel: number };

export const deliveryId = (d: Delivery) => `a${d.t.toFixed(3)}`;

/**
 * The clip around each shot: `leadIn` before it and `length` long, but never reaching into the
 * neighbouring shots, so every ball keeps its own clip however close the next one is. Pass only the
 * shots being kept (not ones marked Not a shot), so a removed fake doesn't shorten its neighbours.
 */
export function clipWindows(
  deliveries: Delivery[],
  leadIn: number,
  length: number,
  duration = Infinity,
): { delivery: Delivery; start: number; end: number }[] {
  const list = [...deliveries].sort((a, b) => a.t - b.t);
  return list.map((d, k) => {
    let start = Math.max(0, d.t - leadIn);
    let end = Math.min(duration, start + length);
    const prev = list[k - 1];
    const next = list[k + 1];
    if (prev) start = Math.min(Math.max(start, (prev.t + d.t) / 2, prev.t + 0.3), d.t - 0.2);
    if (next) end = Math.max(Math.min(end, (d.t + next.t) / 2, next.t - 0.3), d.t + 0.2);
    return { delivery: d, start, end: Math.min(duration, end) };
  });
}
