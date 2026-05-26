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
    }, 800);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-ruga-red pointer-events-none">
      <span
        className="font-display text-black leading-none select-none"
        style={{ fontSize: "clamp(8rem, 28vw, 20rem)" }}
      >
        RUGA.
      </span>
    </div>
  );
}
