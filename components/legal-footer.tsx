import Link from "next/link";
import { Brand } from "./brand";

/** Site footer for public pages, with the privacy and terms links. */
export function LegalFooter() {
  return (
    <footer className="bg-navy-950 text-white/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs sm:px-6">
        <Brand />
        <span className="flex gap-4">
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
        </span>
      </div>
    </footer>
  );
}
