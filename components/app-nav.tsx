"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Brand } from "./brand";

const NAV = [
  { href: "/dashboard", label: "Command Centre" },
  { href: "/planner", label: "Planner" },
  { href: "/calendar", label: "Calendar" },
  { href: "/matches", label: "Matches" },
  { href: "/mindset", label: "Mindset" },
  { href: "/goals", label: "Goals" },
  { href: "/fuel", label: "Fuel" },
  { href: "/highlights", label: "Highlights" },
  { href: "/tracking", label: "Ball Tracking" },
];

export function AppNav({ name }: { name: string }) {
  const path = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="sticky top-0 z-40">
      <div className="bg-navy-950 text-white">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Brand href="/dashboard" />
          <div className="flex items-center gap-1 text-sm">
            <Link href="/portfolio" className="hidden px-3 py-1.5 font-display font-bold uppercase tracking-wider text-white/75 hover:text-white sm:block">
              Portfolio
            </Link>
            <Link href="/profile" className="px-3 py-1.5 font-display font-bold uppercase tracking-wider text-white/75 hover:text-white">
              {name.split(" ")[0]}
            </Link>
            <button onClick={signOut} className="border border-white/25 px-3 py-1 font-display font-bold uppercase tracking-wider text-white/85 hover:border-gold hover:text-gold">
              Sign out
            </button>
          </div>
        </div>
      </div>
      <nav aria-label="Main" className="border-b border-navy-700 bg-navy text-white shadow-[0_2px_0_rgba(0,10,46,0.25)]">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 sm:px-4 [scrollbar-width:none]">
          {NAV.map((item) => {
            const active = path === item.href || path.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="relative shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`block px-3 py-3 font-display text-[0.95rem] font-bold uppercase tracking-wide transition-colors ${
                    active ? "text-gold" : "text-white/80 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
                {active ? (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-2 bottom-0 h-[3px] bg-gold"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
