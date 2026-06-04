"use client";
import { useEffect, useState } from "react";

/** True at >=1024px (Tailwind lg). SSR/first paint returns false (mobile-first),
 * then syncs on mount — so the mobile drawer never flashes open on desktop. */
export function useIsDesktop(query = "(min-width: 1024px)"): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setIsDesktop(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return isDesktop;
}
