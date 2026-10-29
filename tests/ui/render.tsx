import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import en from "../../messages/en.json";
import { ToastProvider } from "@/components/providers/Toaster";
import { UiStateProvider } from "@/components/providers/UiState";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import type { PublicSettings } from "@/lib/api/types";

export const testSettings: PublicSettings = {
  vatRatePercent: 20,
  shipping: { yerevanFee: 1000, otherFee: 2000, freeThreshold: 20000 },
  regions: [
    { code: "yerevan", name: "Yerevan" },
    { code: "lori", name: "Lori" },
  ],
  banners: [],
  store: { phone: "+374 10 000 000", email: "hello@vapehub.am", address: "Yerevan", hours: "10–21" },
  paymentMethods: [
    { method: "cod", enabled: true },
    { method: "idram", enabled: false },
    { method: "arca", enabled: false },
  ],
};

export function renderWithProviders(ui: ReactElement, options: RenderOptions & { settings?: PublicSettings | null } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Yerevan">
      <QueryClientProvider client={client}>
        <ToastProvider>
          <UiStateProvider>
            <SettingsProvider settings={options.settings === undefined ? testSettings : options.settings}>{children}</SettingsProvider>
          </UiStateProvider>
        </ToastProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
  return { client, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** Builds a fetch mock that answers by `METHOD path` (path without the /api/v1 prefix and query). */
export function mockFetch(routes: Record<string, (init: RequestInit | undefined, url: URL) => Response | Promise<Response>>) {
  const calls: { method: string; path: string; init?: RequestInit; url: URL }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input.toString(), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, "");
    calls.push({ method, path, init, url });
    const handler = routes[`${method} ${path}`];
    if (!handler) return json({ error: { code: "NOT_FOUND", message: `no mock for ${method} ${path}` } }, 404);
    return handler(init, url);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

export const csrfRoute = { "GET /auth/csrf": () => json({ data: { csrfToken: "test.csrf" } }) };
