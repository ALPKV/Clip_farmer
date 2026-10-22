import Link from "next/link";
import { Brand } from "@/components/brand";
import { LegalFooter } from "@/components/legal-footer";

/** Public pages (privacy, terms): readable without an account. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="bg-navy-950">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <nav className="flex gap-4 font-display text-sm font-bold uppercase tracking-wider text-white/80">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">{children}</main>
      <LegalFooter />
    </div>
  );
}
