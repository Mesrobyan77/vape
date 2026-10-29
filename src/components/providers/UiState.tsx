"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Panel = "cart" | "search" | "menu" | null;

interface UiState {
  panel: Panel;
  open: (panel: Exclude<Panel, null>) => void;
  close: () => void;
  toggle: (panel: Exclude<Panel, null>) => void;
}

const UiContext = createContext<UiState | null>(null);

/** Only one overlay (cart drawer, search, mobile menu) is open at a time. */
export function UiStateProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  const open = useCallback((p: Exclude<Panel, null>) => setPanel(p), []);
  const close = useCallback(() => setPanel(null), []);
  const toggle = useCallback((p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p)), []);
  const value = useMemo(() => ({ panel, open, close, toggle }), [panel, open, close, toggle]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiState {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside <UiStateProvider>");
  return ctx;
}
