"use client";

import { useEffect, useState } from "react";

export function Preloader() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem("ruga_preloaded")) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => {
      setShow(false);
      sessionStorage.setItem("ruga_preloaded", "1");
    }, 1600);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-ruga-red pointer-events-none">
      <span
        className="font-display text-black leading-none select-none"
        style={{
          fontSize: "clamp(8rem, 28vw, 20rem)",
          animation: "slam 320ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards",
        }}
      >
        RUGA.
      </span>
      <span
        className="font-mono text-black/70 uppercase tracking-widest select-none"
        style={{
          fontSize: "clamp(0.6rem, 1.8vw, 1rem)",
          marginTop: "clamp(0.75rem, 2vw, 1.5rem)",
          animation: "slam-sub 280ms ease-out 420ms both",
        }}
      >
        bet on rugs · make money · easy peasy
      </span>
    </div>
  );
}
