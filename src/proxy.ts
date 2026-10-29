import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

const handleI18n = createIntlMiddleware(routing);

const isDev = process.env.NODE_ENV !== "production";

/** Payment providers the browser may submit a form to (Idram uses a POST form). */
const PAYMENT_FORM_TARGETS = ["https://banking.idram.am", "https://ipay.arca.am", "https://ipaytest.arca.am:8445"];

export function buildCsp(nonce: string): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // next/font and motion set inline styles; styles cannot execute script.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https://res.cloudinary.com", "https://images.pexels.com"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", ...(isDev ? ["ws:"] : [])],
    "frame-src": ["https://www.google.com"],
    "form-action": ["'self'", ...PAYMENT_FORM_TARGETS],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
  };
  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const { pathname } = request.nextUrl;
  const response =
    pathname === "/admin" || pathname.startsWith("/admin/")
      ? NextResponse.next({ request: { headers } })
      : handleI18n(new NextRequest(request, { headers }));

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Skip API routes, Next internals and static files (anything with a file extension).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
