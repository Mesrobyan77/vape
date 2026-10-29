"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicSettings } from "@/lib/api/types";

const SettingsContext = createContext<PublicSettings | null>(null);

export function SettingsProvider({ settings, children }: { settings: PublicSettings | null; children: ReactNode }) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

/** Public store settings loaded on the server; `null` when the store database is unreachable. */
export function useSettings(): PublicSettings | null {
  return useContext(SettingsContext);
}
