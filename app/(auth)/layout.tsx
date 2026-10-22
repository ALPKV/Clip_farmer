import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/brand";
import { currentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await currentUser()) redirect("/dashboard");
  return (
    <div className="grid min-h-screen md:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-navy p-10 text-white md:flex md:flex-col md:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07] [background:repeating-linear-gradient(115deg,#fff_0_1px,transparent_1px_22px)]" />
        <Brand />
        <div className="relative">
          <p className="eyebrow text-gold">Practice with a plan</p>
          <p className="display mt-3 max-w-md text-5xl font-extrabold">
            Every net, sprint and meal counted.
          </p>
          <p className="mt-4 max-w-md text-white/70">
            Plan sessions, keep your workload in check, track season goals and turn net videos into
            clips with ball tracking. All in one place.
          </p>
        </div>
        <p className="relative text-xs text-white/50">
          Videos are analysed in your browser and never uploaded.{" "}
          <Link href="/privacy" className="underline hover:text-white">Privacy</Link> ·{" "}
          <Link href="/terms" className="underline hover:text-white">Terms</Link>
        </p>
      </aside>
      <main className="flex items-center justify-center bg-paper px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <div className="inline-block bg-navy px-3 py-2">
              <Brand />
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
