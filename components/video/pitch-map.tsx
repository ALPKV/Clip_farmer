import { LENGTH_ZONES } from "@/lib/tracking/metrics";

export type PitchPoint = { length: number; line: number | null; current?: boolean; speed?: number | null };

/**
 * Top-down pitch map of the batter's half: length in metres from the stumps (top) and line in
 * cm from middle stump. Deliveries without a line estimate sit on the middle-stump line, hollow.
 */
export function PitchMap({ points }: { points: PitchPoint[] }) {
  const W = 220;
  const H = 400;
  const maxLen = 12; // metres shown
  const halfWidthCm = 152; // pitch is 3.05 m wide
  const y = (m: number) => 30 + (m / maxLen) * (H - 40);
  const x = (cm: number) => W / 2 + (cm / halfWidthCm) * (W / 2 - 14);
  const shades = ["#efe3c8", "#e6d5b0", "#dcc79a", "#e6d5b0", "#efe3c8"];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full max-w-[260px]" role="img" aria-label="Pitch map">
      <rect x="0" y="0" width={W} height={H} fill="#0a5c36" />
      <rect x="14" y="20" width={W - 28} height={H - 20} fill="#d8c49c" />
      {LENGTH_ZONES.map((z, k) => {
        const top = y(z.from);
        const bottom = y(Math.min(z.to, maxLen));
        if (top >= H) return null;
        return (
          <g key={z.label}>
            <rect x="14" y={top} width={W - 28} height={bottom - top} fill={shades[k]} />
            <text x="18" y={top + 13} fontSize="9" fontWeight="700" fill="#5b4a2a" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {z.label}
            </text>
            <text x={W - 18} y={top + 13} fontSize="9" textAnchor="end" fill="#7a6845">
              {z.from}m
            </text>
          </g>
        );
      })}
      {/* Popping crease and stumps */}
      <line x1="14" x2={W - 14} y1={y(1.22)} y2={y(1.22)} stroke="#fff" strokeWidth="1.5" />
      <rect x={x(-11.43)} y={y(0) - 4} width={x(11.43) - x(-11.43)} height="5" fill="#00175f" />
      <line x1={W / 2} x2={W / 2} y1={y(0)} y2={H} stroke="#00175f" strokeOpacity="0.18" strokeDasharray="3 4" />
      {points.map((p, k) => {
        if (p.length > maxLen) return null;
        const cx = x(Math.max(-halfWidthCm, Math.min(halfWidthCm, p.line ?? 0)));
        const cy = y(p.length);
        return p.current ? (
          <g key={k}>
            <circle cx={cx} cy={cy} r="9" fill="none" stroke="#c8102e" strokeWidth="2" />
            <circle cx={cx} cy={cy} r="5" fill="#c8102e" />
          </g>
        ) : (
          <circle
            key={k}
            cx={cx}
            cy={cy}
            r="5"
            fill={p.line == null ? "none" : "#00175f"}
            stroke="#00175f"
            strokeWidth="1.5"
            opacity="0.85"
          />
        );
      })}
    </svg>
  );
}
