"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export function ErrorState({
  message,
  onRetry,
  retrying,
  compact,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("common");
  return (
    <div
      role="alert"
      className={`flex flex-col items-center gap-4 text-center ${compact ? "py-6" : "py-12"}`}
      data-testid="error-state"
    >
      <TriangleAlert className="h-10 w-10 text-danger" aria-hidden />
      <p className="lead text-white">{message}</p>
      {onRetry ? (
        <button type="button" className="cus-btn" onClick={onRetry} disabled={retrying} aria-busy={retrying}>
          {retrying ? <span className="spinner" aria-hidden /> : <RefreshCw className="!h-5 !w-5" aria-hidden />}
          {t("retry")}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center gap-4 rounded-[10px] px-6 py-14 text-center" data-testid="empty-state">
      {icon}
      <h2 className="h5 text-white">{title}</h2>
      {body ? <p className="max-w-[520px]">{body}</p> : null}
      {action}
    </div>
  );
}

export function FormAlert({ tone, children, id }: { tone: "error" | "success" | "info" | "warning"; children: ReactNode; id?: string }) {
  return (
    <div id={id} className={`form-alert is-${tone}`} role={tone === "error" ? "alert" : "status"} data-testid={`form-${tone}`}>
      {children}
    </div>
  );
}
