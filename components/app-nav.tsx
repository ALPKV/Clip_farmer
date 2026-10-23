"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./brand";

const NAV = [
  { href: "/highlights", label: "Highlights" },
  { href: "/tracking", label: "Ball Tracking" },
];

export function AppNav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-40 bg-navy-950 text-white shadow-[0_2px_0_rgba(0,10,46,0.25)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Brand href="/highlights" />
        <nav aria-label="Main">
          <ul className="flex gap-1">
            {NAV.map((item) => {
              const active = path === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block px-3 py-2 font-display text-[0.95rem] font-bold uppercase tracking-wide ${
                      active ? "text-gold" : "text-white/80 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
