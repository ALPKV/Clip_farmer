import type { ReactNode } from "react";

/** Building blocks for the privacy and terms pages. */

export function LegalTitle({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <header className="border-b border-line pb-6">
      <p className="eyebrow text-gold-600">Last updated {updated}</p>
      <h1 className="display mt-2 text-4xl font-extrabold text-navy sm:text-5xl">{title}</h1>
      <div className="mt-4 text-[1.02rem] text-slate">{children}</div>
    </header>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="display text-2xl font-extrabold text-navy">{title}</h2>
      <div className="mt-2 space-y-3 text-[0.98rem] leading-relaxed text-ink [&_a]:font-semibold [&_a]:text-navy [&_a]:underline [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </section>
  );
}
