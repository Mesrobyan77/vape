"use client";

import { useEffect, useRef } from "react";

const MAX_PARTICLES = 22;
const LIFE_MS = 520;
const MIN_DISTANCE = 6;
const COLORS = ["202, 172, 240", "118, 65, 186"]; // brand lavender / purple

interface Particle {
  x: number;
  y: number;
  born: number;
  radius: number;
  color: string;
}

/** True when the device and the user's preferences allow the decorative trail. */
export function cursorTrailSupported(win: Pick<Window, "matchMedia"> = window): boolean {
  const fine = win.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return fine && !reduced;
}

/**
 * Subtle cursor trail (original addition, not in the reference). A single
 * pointer-events:none canvas behind page content; animation frames run only while
 * particles are alive, pause when the tab is hidden, and nothing triggers React renders.
 */
export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const fineQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let enabled = cursorTrailSupported(window);
    const particles: Particle[] = [];
    let frame = 0;
    let lastX = -1000;
    let lastY = -1000;
    let colorIndex = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      frame = 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]!;
        const age = (now - p.born) / LIFE_MS;
        if (age >= 1) {
          particles.splice(i, 1);
          continue;
        }
        const alpha = (1 - age) * 0.55;
        ctx.beginPath();
        ctx.fillStyle = `rgba(${p.color}, ${alpha})`;
        ctx.arc(p.x, p.y, p.radius * (1 - age * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      if (particles.length > 0 && !document.hidden) frame = requestAnimationFrame(draw);
    };

    const schedule = () => {
      if (!frame && enabled && !document.hidden) frame = requestAnimationFrame(draw);
    };

    const onMove = (event: PointerEvent) => {
      if (!enabled || event.pointerType !== "mouse") return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (dx * dx + dy * dy < MIN_DISTANCE * MIN_DISTANCE) return;
      lastX = event.clientX;
      lastY = event.clientY;
      colorIndex = (colorIndex + 1) % COLORS.length;
      particles.push({ x: lastX, y: lastY, born: performance.now(), radius: 4.5, color: COLORS[colorIndex]! });
      if (particles.length > MAX_PARTICLES) particles.shift();
      schedule();
    };

    const onVisibility = () => {
      if (document.hidden && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        schedule();
      }
    };

    const onPreferenceChange = () => {
      enabled = cursorTrailSupported(window);
      if (!enabled) {
        particles.length = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    fineQuery.addEventListener("change", onPreferenceChange);
    reducedQuery.addEventListener("change", onPreferenceChange);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
      fineQuery.removeEventListener("change", onPreferenceChange);
      reducedQuery.removeEventListener("change", onPreferenceChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden
      data-testid="cursor-trail"
    />
  );
}
