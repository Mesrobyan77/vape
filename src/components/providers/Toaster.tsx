"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";

export type ToastTone = "success" | "error" | "info";

interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DISMISS_MS = { success: 4000, info: 5000, error: 7000 } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-3), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), DISMISS_MS[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
      info: (m) => show(m, "info"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  const t = useTranslations("common");
  const polite = toasts.filter((x) => x.tone !== "error");
  const assertive = toasts.filter((x) => x.tone === "error");
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100001] flex flex-col items-end gap-2 sm:left-auto sm:right-6 sm:w-[380px]">
      {/* Two live regions so errors interrupt but confirmations do not. */}
      <div role="status" aria-live="polite" className="contents">
        {polite.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} closeLabel={t("close")} />
        ))}
      </div>
      <div role="alert" aria-live="assertive" className="contents">
        {assertive.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} closeLabel={t("close")} />
        ))}
      </div>
    </div>
  );
}

function ToastItem({ toast, onDismiss, closeLabel }: { toast: Toast; onDismiss: (id: number) => void; closeLabel: string }) {
  const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? TriangleAlert : Info;
  const tone =
    toast.tone === "success" ? "border-success" : toast.tone === "error" ? "border-danger" : "border-primary-2";
  return (
    <div
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-[10px] border bg-surface px-4 py-3 text-white shadow-2xl ${tone}`}
      data-testid="toast"
      data-tone={toast.tone}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p className="flex-1 text-[15px] leading-snug">{toast.message}</p>
      <button type="button" className="icon-btn !min-h-6 !min-w-6" onClick={() => onDismiss(toast.id)} aria-label={closeLabel}>
        <X className="!h-4 !w-4" aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
