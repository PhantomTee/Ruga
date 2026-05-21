"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-ruga-red flex flex-col">
      <header className="flex items-center justify-between px-6 py-5 border-b-2 border-black">
        <Link href="/" className="font-display text-2xl leading-none text-black">RUGA</Link>
      </header>
      <section className="flex-1 flex flex-col justify-center px-6 py-16">
        <h1 className="font-display leading-none text-black" style={{ fontSize: "clamp(4rem, 18vw, 14rem)" }}>
          BROKE.
        </h1>
        <p className="font-mono text-sm text-black/60 mt-4 max-w-sm">
          {error.message || "Something went wrong on our end."}
        </p>
        <div className="flex flex-wrap gap-3 mt-10">
          <button
            onClick={reset}
            className="font-display text-2xl bg-black text-white px-8 py-3 border-2 border-black hover:bg-ruga-dim transition-colors"
          >
            TRY AGAIN →
          </button>
          <Link
            href="/"
            className="font-display text-2xl bg-ruga-red text-black px-8 py-3 border-2 border-black hover:bg-black hover:text-white transition-colors"
          >
            HOME
          </Link>
        </div>
      </section>
    </main>
  );
}
