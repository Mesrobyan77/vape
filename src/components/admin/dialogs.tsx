"use client";

import { X } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import cn from "clsx";
import { useDialog } from "@/hooks/use-dialog";
import { Button } from "./ui";

/** Accessible modal: focus trap, Escape to close, scroll lock and focus restore (see use-dialog). */
export function AdminDialog({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  wide,
  testId,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();
  useDialog(ref, open, onClose);
  if (!open) return null;
  return (
    <div
      className="adm-dialog-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={cn("adm-dialog", wide && "is-wide")}
        data-testid={testId}
      >
        <div className="adm-dialog-head">
          <div style={{ minWidth: 0 }}>
            <h2 id={titleId} className="adm-dialog-title">
              {title}
            </h2>
            {description ? (
              <p id={descId} className="adm-dialog-desc">
                {description}
              </p>
            ) : null}
          </div>
          <button type="button" className="adm-iconbtn" style={{ marginLeft: "auto" }} onClick={onClose} aria-label="Close dialog">
            <X aria-hidden />
          </button>
        </div>
        <div className="adm-dialog-body">{children}</div>
        {footer ? <div className="adm-dialog-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Confirmation step for destructive or irreversible actions. */
export function AdminConfirm({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  pending,
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, open, () => !pending && onCancel(), { initialFocus: cancelRef });
  if (!open) return null;
  return (
    <div className="adm-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !pending && onCancel()}>
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="adm-confirm-title"
        aria-describedby={body ? "adm-confirm-body" : undefined}
        className="adm-dialog"
        data-testid="confirm-dialog"
      >
        <div className="adm-dialog-head">
          <h2 id="adm-confirm-title" className="adm-dialog-title">
            {title}
          </h2>
        </div>
        {body ? (
          <div id="adm-confirm-body" className="adm-dialog-body">
            {body}
          </div>
        ) : null}
        <div className="adm-dialog-foot">
          <Button ref={cancelRef} variant="quiet" onClick={onCancel} disabled={pending} data-testid="confirm-cancel">
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} className={danger ? "is-solid" : undefined} onClick={onConfirm} disabled={pending} aria-busy={pending} data-testid="confirm-action">
            {pending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
