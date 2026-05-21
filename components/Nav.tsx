"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectKitButton } from "connectkit";

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => path === href;

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      onClick={() => setOpen(false)}
      className={`font-mono text-xs uppercase tracking-widest transition-opacity ${
        isActive(href) ? "opacity-100 underline underline-offset-4" : "opacity-50 hover:opacity-100"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <>
      <nav className="sticky top-0 z-40 border-b-2 border-black bg-ruga-red">
        <div className="flex items-center justify-between px-6 py-4">
          {/* Logo */}
          <Link href="/" className="font-display text-2xl leading-none text-black shrink-0">
            RUGA
          </Link>

          {/* Desktop links */}
          <div className="hidden sm:flex items-center gap-8">
            {navLink("/markets", "Markets")}
            {navLink("/leaderboard", "Leaderboard")}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <ConnectKitButton />
            {/* Hamburger — mobile only */}
            <button
              onClick={() => setOpen((o) => !o)}
              className="sm:hidden border-2 border-black w-9 h-9 flex flex-col items-center justify-center gap-1.5 hover:bg-black hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              <span
                className={`block w-4 h-0.5 bg-current transition-transform origin-center ${
                  open ? "rotate-45 translate-y-2" : ""
                }`}
              />
              <span
                className={`block w-4 h-0.5 bg-current transition-opacity ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`block w-4 h-0.5 bg-current transition-transform origin-center ${
                  open ? "-rotate-45 -translate-y-2" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {open && (
          <div className="sm:hidden border-t-2 border-black bg-ruga-red px-6 py-4 flex flex-col gap-4">
            {navLink("/markets", "Markets")}
            {navLink("/leaderboard", "Leaderboard")}
          </div>
        )}
      </nav>
    </>
  );
}
