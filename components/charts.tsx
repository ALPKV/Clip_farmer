import type { WeekLoad } from "@/lib/domain";

/** 1, 2 or 5 × a power of ten, at least `raw`. */
function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
}

/** Weekly training load bars; weeks more than 20% above the previous one are red. */
export function WorkloadChart({ loads }: { loads: WeekLoad[] }) {
  const W = 640;
  const H = 220;
  const pad = { l: 44, r: 10, t: 14, b: 34 };
  const top = Math.max(100, ...loads.map((l) => l.load)) * 1.1;
  const step = niceStep(top / 4);
  const max = Math.ceil(top / step) * step;
  const bw = (W - pad.l - pad.r) / loads.length;
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, k) => k * step);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Weekly training load">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#dde2e8" />
          <text x={pad.l - 6} y={y(t) + 4} fontSize="11" textAnchor="end" fill="#8996a0">{t}</text>
        </g>
      ))}
      {loads.map((l, k) => {
        const x = pad.l + k * bw + bw * 0.18;
        const w = bw * 0.64;
        const current = k === loads.length - 1;
        const fill = l.risk ? "#c8102e" : current ? "#ffc700" : "#00175f";
        const label = new Date(`${l.week}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        return (
          <g key={l.week}>
            <rect x={x} y={y(l.load)} width={w} height={Math.max(0, y(0) - y(l.load))} fill={fill} />
            {l.load > 0 ? (
              <text x={x + w / 2} y={y(l.load) - 4} fontSize="11" fontWeight="700" textAnchor="middle" fill="#121826">{l.load}</text>
            ) : null}
            <text x={x + w / 2} y={H - 14} fontSize="11" textAnchor="middle" fill={current ? "#00175f" : "#8996a0"} fontWeight={current ? 700 : 400}>
              {current ? "This wk" : label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Small line chart for trends (runs per innings, speeds…). */
export function TrendChart({ values, labels, unit = "", color = "#00175f" }: { values: number[]; labels: string[]; unit?: string; color?: string }) {
  const W = 640;
  const H = 200;
  const pad = { l: 40, r: 12, t: 16, b: 30 };
  if (values.length === 0) return null;
  const max = Math.max(...values, 1) * 1.15;
  const x = (k: number) => pad.l + (values.length === 1 ? (W - pad.l - pad.r) / 2 : (k / (values.length - 1)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = values.map((v, k) => `${k ? "L" : "M"}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Trend">
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#dde2e8" />
      <line x1={pad.l} x2={W - pad.r} y1={y(avg)} y2={y(avg)} stroke="#ffc700" strokeWidth="2" strokeDasharray="6 5" />
      <text x={W - pad.r} y={y(avg) - 5} fontSize="11" textAnchor="end" fill="#8a6d00" fontWeight="700">
        avg {avg.toFixed(1)}{unit}
      </text>
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
      {values.map((v, k) => (
        <g key={k}>
          <circle cx={x(k)} cy={y(v)} r="4" fill="#fff" stroke={color} strokeWidth="2" />
          {values.length <= 16 ? (
            <text x={x(k)} y={H - 10} fontSize="10" textAnchor="middle" fill="#8996a0">{labels[k]}</text>
          ) : null}
        </g>
      ))}
    </svg>
  );
}
