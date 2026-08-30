"use client";
import * as React from "react";

/** Keyboard-first POS: "/" search, F8 KOT, F9 pay, F10 hold, Esc close sheet. Ignores keys typed into inputs (except Esc and F-keys). */
export function useHotkeys(map: Record<string, () => void>) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = (e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA/);
      const key = e.key;
      if (inField && !key.startsWith("F") && key !== "Escape") return;
      const fn = map[key];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [map]);
}
