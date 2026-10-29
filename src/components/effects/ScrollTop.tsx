"use client";

import { ArrowUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

/** Back-to-top button with the reference's circular scroll-progress ring. */
export function ScrollTop() {
  const t = useTranslations("common");
  const pathRef = useRef<SVGPathElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length} ${length}`;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      path.style.strokeDashoffset = String(length - progress * length);
      setActive(window.scrollY > window.innerHeight);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <button
      type="button"
      className={`scroll-top ${active ? "is-active" : ""}`}
      aria-label={t("backToTop")}
      tabIndex={active ? 0 : -1}
      onClick={() => {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
      }}
    >
      <svg className="scroll-top__ring" viewBox="-1 -1 102 102" aria-hidden>
        <path ref={pathRef} d="M50,1 a49,49 0 0,1 0,98 a49,49 0 0,1 0,-98" />
      </svg>
      <ArrowUp className="relative h-5 w-5" aria-hidden />
    </button>
  );
}
