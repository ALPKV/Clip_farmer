import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Tone = "navy" | "gold" | "ghost" | "danger" | "light";

const tones: Record<Tone, string> = {
  navy: "bg-navy text-white hover:bg-navy-700",
  gold: "bg-gold text-navy-950 hover:bg-gold-600",
  ghost: "bg-transparent text-navy border border-navy/25 hover:border-navy hover:bg-navy-100",
  danger: "bg-transparent text-risk border border-risk/30 hover:bg-risk hover:text-white",
  light: "bg-white/10 text-white border border-white/25 hover:bg-white/20",
};

const btn = (tone: Tone, size: "sm" | "md") =>
  `inline-flex items-center justify-center gap-2 font-display font-bold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:pointer-events-none ${
    size === "sm" ? "h-8 px-3 text-[0.8rem]" : "h-10 px-5 text-[0.95rem]"
  } ${tones[tone]}`;

export function Button({
  tone = "navy",
  size = "md",
  className = "",
  ...rest
}: ComponentProps<"button"> & { tone?: Tone; size?: "sm" | "md" }) {
  return <button className={`${btn(tone, size)} ${className}`} {...rest} />;
}

export function ButtonLink({
  tone = "navy",
  size = "md",
  className = "",
  ...rest
}: ComponentProps<typeof Link> & { tone?: Tone; size?: "sm" | "md" }) {
  return <Link className={`${btn(tone, size)} ${className}`} {...rest} />;
}

/** Navy band at the top of each page, in the style of a match-centre header. */
export function PageHeader({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden bg-navy text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(115deg,#fff_0_1px,transparent_1px_22px)]" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between md:py-10">
        <div>
          <p className="eyebrow text-gold">{eyebrow}</p>
          <h1 className="display mt-2 text-4xl font-extrabold sm:text-5xl">{title}</h1>
          {children ? <div className="mt-3 max-w-2xl text-[0.98rem] text-white/75">{children}</div> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
  flush = false,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`border border-line bg-white ${className}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="display flex items-center gap-2 text-[1.15rem] font-bold text-navy">
            <span aria-hidden className="inline-block h-4 w-1 bg-gold" />
            {title}
          </h2>
          {action}
        </div>
      ) : null}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  unit,
  note,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  tone?: "default" | "risk" | "ok" | "dark";
}) {
  const dark = tone === "dark";
  return (
    <div className={`${dark ? "bg-navy-900 text-white" : "bg-white"} border-l-4 ${tone === "risk" ? "border-risk" : tone === "ok" ? "border-ok" : "border-gold"} px-4 py-3`}>
      <p className={`eyebrow ${dark ? "text-white/60" : "text-mute"}`}>{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className={`display text-4xl font-extrabold ${dark ? "" : "text-navy"}`}>{value}</span>
        {unit ? <span className={`text-sm font-semibold ${dark ? "text-white/60" : "text-slate"}`}>{unit}</span> : null}
      </p>
      {note ? <p className={`mt-1 text-xs ${dark ? "text-white/60" : "text-slate"}`}>{note}</p> : null}
    </div>
  );
}

export function Tag({ children, tone = "navy" }: { children: ReactNode; tone?: "navy" | "gold" | "risk" | "ok" | "mute" }) {
  const t = {
    navy: "bg-navy-100 text-navy",
    gold: "bg-gold text-navy-950",
    risk: "bg-risk text-white",
    ok: "bg-ok/10 text-ok",
    mute: "bg-paper text-slate",
  }[tone];
  return <span className={`inline-flex items-center px-2 py-0.5 font-display text-[0.75rem] font-bold uppercase tracking-wider ${t}`}>{children}</span>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="border border-dashed border-line px-6 py-10 text-center">
      <p className="display text-lg font-bold text-navy">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-sm text-slate">{children}</div> : null}
    </div>
  );
}

export function Meter({ value, max, tone = "navy" }: { value: number; max: number; tone?: "navy" | "gold" | "ok" | "risk" }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const c = { navy: "bg-navy", gold: "bg-gold", ok: "bg-ok", risk: "bg-risk" }[tone];
  return (
    <div className="h-2 w-full bg-paper" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full ${c} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8 ${className}`}>{children}</div>;
}

export const fmt = {
  date: (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
  num: (n: number | null | undefined, digits = 0) => (n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits)),
};
