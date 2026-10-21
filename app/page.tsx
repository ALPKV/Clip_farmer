import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { ButtonLink } from "@/components/ui";
import { currentUser } from "@/lib/auth";

const PILLARS = [
  { n: "01", title: "Plan", body: "Open nets, scenario nets, drills, machine work, spot bowling, new skills and conditioning, each with an intent written before you start." },
  { n: "02", title: "Load", body: "Minutes × effort for every session. A calendar of work and recovery, and a red flag when your week jumps more than 20%." },
  { n: "03", title: "Perform", body: "Match logs with error analysis, season goals that update themselves, badges for consistency, and a carb tracker for match days." },
  { n: "04", title: "Review", body: "Drop in a full net session. Clip Farmer cuts every shot from the audio; Ball Tracking follows the ball and times its speed." },
];

export default async function Home() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-navy-950">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <nav className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wider text-white/80 hover:text-white">Sign in</Link>
            <ButtonLink href="/signup" tone="gold" size="sm">Create account</ButtonLink>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-navy text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(115deg,#fff_0_1px,transparent_1px_22px)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-24">
          <div>
            <p className="eyebrow text-gold">For youth and club cricketers</p>
            <h1 className="display mt-4 text-6xl font-extrabold sm:text-7xl lg:text-8xl">
              Stop just<br />showing up<br /><span className="italic text-gold">to nets.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-white/75">
              Flipper is the command centre that turns practice into a plan: what you&apos;ll work on, how hard
              you trained, how you performed and what the video says.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" tone="gold">Start free</ButtonLink>
              <ButtonLink href="/login" tone="light">Sign in</ButtonLink>
            </div>
          </div>
          <div className="self-end border border-white/15 bg-navy-900/70 p-5">
            <p className="eyebrow text-white/60">This week</p>
            <div className="mt-3 grid grid-cols-3 gap-px bg-white/10">
              {[["Load", "1,840", "AU"], ["Sessions", "5", ""], ["Speed", "112", "km/h"]].map(([l, v, u]) => (
                <div key={l} className="bg-navy-900 p-3">
                  <p className="eyebrow text-white/50">{l}</p>
                  <p className="display mt-1 text-3xl font-extrabold">{v}<span className="ml-1 text-sm font-semibold text-white/60">{u}</span></p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-1.5">
              {[38, 52, 47, 60, 58, 71].map((h, k) => (
                <span key={k} className="flex-1 bg-white/10"><span className={`block ${k === 5 ? "bg-gold" : "bg-white/70"}`} style={{ height: `${h}px`, marginTop: `${72 - h}px` }} /></span>
              ))}
            </div>
            <p className="mt-3 text-xs text-white/50">Example data</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <p className="eyebrow text-mute">How it works</p>
        <h2 className="display mt-2 text-4xl font-extrabold text-navy">Four habits of a professional</h2>
        <div className="mt-10 grid gap-px bg-line md:grid-cols-4">
          {PILLARS.map((p) => (
            <article key={p.n} className="bg-white p-6">
              <p className="display text-5xl font-extrabold text-gold">{p.n}</p>
              <h3 className="display mt-3 text-2xl font-extrabold text-navy">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-2">
          <div>
            <p className="eyebrow text-mute">Video lab</p>
            <h2 className="display mt-2 text-4xl font-extrabold text-navy">Your videos never leave your device</h2>
          </div>
          <p className="text-slate">
            Clip Farmer and Ball Tracking run entirely in your browser. A 20-minute net session is scanned for
            bat-on-ball contact, clipped and tracked on your own computer, so there are no uploads, no queue and no
            cost. Speed and length are timing estimates: you can check every mark frame by frame.
          </p>
        </div>
      </section>

      <footer className="bg-navy-950 text-white/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs sm:px-6">
          <Brand />
          <span>Built for cricketers who practise with a purpose.</span>
        </div>
      </footer>
    </div>
  );
}
