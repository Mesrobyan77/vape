"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LETTERS = ["V", "A", "P", "E", "H", "U", "B"];
const MIN_VISIBLE_MS = 500;
const MAX_VISIBLE_MS = 1800; // reference: fadeOut after 1.8 s
const ROUTE_MIN_VISIBLE_MS = 700;
const ROUTE_MAX_VISIBLE_MS = 4000; // a navigation that never lands cannot leave the overlay up
const FADE_MS = 700;

/** Same-origin, same-tab link to a different page (not a hash jump, download or new tab). */
function navigatesAway(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  const anchor = (event.target as Element | null)?.closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  return url.pathname !== window.location.pathname;
}

/**
 * The reference's "VAPEHUB" letter preloader. Shown on the first full page load and again on
 * every client-side page change: it appears when an internal link is clicked and fades once the
 * new route has rendered. Never blocks longer than its caps, is skipped for reduced motion, and
 * has a CSS-only fallback (`.preloader` animation in globals) for the initial load so it
 * disappears even if JavaScript fails.
 */
export function Preloader() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [initial, setInitial] = useState(true);
  const shownAt = useRef(0);
  const firstPath = useRef(pathname);

  // Initial full page load.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      const frame = requestAnimationFrame(() => {
        setHidden(true);
        setRemoved(true);
      });
      return () => cancelAnimationFrame(frame);
    }
    const start = performance.now();
    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start));
      window.setTimeout(() => setHidden(true), wait);
    };
    const cap = window.setTimeout(hide, MAX_VISIBLE_MS);
    if (document.readyState === "complete") hide();
    else window.addEventListener("load", hide, { once: true });
    return () => {
      window.clearTimeout(cap);
      window.removeEventListener("load", hide);
    };
  }, []);

  // Show again whenever an internal link starts a navigation.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onClick = (event: MouseEvent) => {
      if (!navigatesAway(event)) return;
      shownAt.current = performance.now();
      setInitial(false);
      setRemoved(false);
      setHidden(false);
    };
    // Capture phase: next/link calls preventDefault in React's (bubbling) handler.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Hide once the new route has rendered (or after the cap if it never does).
  useEffect(() => {
    if (initial || hidden) return;
    const landed = pathname !== firstPath.current;
    const elapsed = performance.now() - shownAt.current;
    const wait = landed ? Math.max(0, ROUTE_MIN_VISIBLE_MS - elapsed) : ROUTE_MAX_VISIBLE_MS;
    const id = window.setTimeout(() => {
      firstPath.current = pathname;
      setHidden(true);
    }, wait);
    return () => window.clearTimeout(id);
  }, [pathname, initial, hidden]);

  useEffect(() => {
    if (!hidden) return;
    firstPath.current = pathname;
    const id = window.setTimeout(() => setRemoved(true), FADE_MS);
    return () => window.clearTimeout(id);
  }, [hidden, pathname]);

  if (removed) return null;
  return (
    <div className={`preloader ${initial ? "preloader--fallback" : ""} ${hidden ? "is-hidden" : ""}`} aria-hidden data-testid="preloader">
      <div className="preloader__word">
        {LETTERS.map((letter, i) => (
          <span key={i} data-text={letter}>
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
