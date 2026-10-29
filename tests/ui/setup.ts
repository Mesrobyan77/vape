import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import React from "react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.className = "";
  document.cookie.split(";").forEach((c) => {
    document.cookie = `${c.split("=")[0]?.trim()}=; Max-Age=0; Path=/`;
  });
});

// jsdom lacks matchMedia; tests override per case.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      onchange: null,
      dispatchEvent: () => false,
    }),
  });
}

// next/image → plain <img> (no optimizer in unit tests).
vi.mock("next/image", () => ({
  default: ({ src, alt, priority: _p, fill: _f, sizes: _s, ...rest }: Record<string, unknown>) =>
    React.createElement("img", { src: typeof src === "string" ? src : "", alt: alt as string, ...rest }),
}));

export const routerMock = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() };

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  usePathname: () => "/hy",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("notFound");
  },
}));

// Localized navigation helpers → simple anchors / mocks.
vi.mock("@/i18n/navigation", () => ({
  Link: React.forwardRef<HTMLAnchorElement, Record<string, unknown>>(function Link({ href, locale: _l, children, ...rest }, ref) {
    const url = typeof href === "string" ? href : String((href as { pathname?: string })?.pathname ?? "");
    return React.createElement("a", { href: url, ref, ...rest }, children as React.ReactNode);
  }),
  useRouter: () => routerMock,
  usePathname: () => "/",
  redirect: vi.fn(),
  getPathname: () => "/",
}));
