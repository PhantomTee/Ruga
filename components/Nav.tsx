"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectKitButton } from "connectkit";

export function Nav() {
  const path = usePathname();
  const link = (href: string, label: string) => (
    <Link
      href={href}
      className={`font-mono text-xs uppercase tracking-widest transition-opacity ${
        path === href ? "opacity-100 underline underline-offset-4" : "opacity-50 hover:opacity-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-40 border-b-2 border-black bg-ruga-red flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-8">
        <Link href="/" className="font-display text-2xl leading-none text-black">
          RUGA
        </Link>
        {link("/markets", "Markets")}
        {link("/leaderboard", "Leaderboard")}
      </div>
      <ConnectKitButton />
    </nav>
  );
}
