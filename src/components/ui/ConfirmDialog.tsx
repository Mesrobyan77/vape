"use client";

import { useTranslations } from "next-intl";
import { useRef, type ReactNode } from "react";
import { useDialog } from "@/hooks/use-dialog";

/** Accessible confirmation step for destructive or irreversible actions. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending,
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useDialog(ref, open, () => !pending && onCancel(), { initialFocus: cancelRef });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100002] grid place-items-center bg-black/75 p-4" onMouseDown={(e) => e.target === e.currentTarget && !pending && onCancel()}>
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={body ? "confirm-body" : undefined}
        className="w-full max-w-[460px] rounded-[10px] border border-white/10 bg-surface p-6"
        data-testid="confirm-dialog"
      >
        <h2 id="confirm-title" className="h6 mb-12 text-white">
          {title}
        </h2>
        {body ? (
          <div id="confirm-body" className="mb-24">
            {body}
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-3">
          <button ref={cancelRef} type="button" className="cus-btn is-sm" onClick={onCancel} disabled={pending}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className={`cus-btn is-sm is-filled ${danger ? "is-danger" : ""}`}
            onClick={onConfirm}
            disabled={pending}
            aria-busy={pending}
            data-testid="confirm-action"
          >
            {pending ? <span className="spinner" aria-hidden /> : null}
            {confirmLabel ?? t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
