"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { useDialog } from "@/hooks/use-dialog";
import { useErrorMessage } from "@/hooks/use-error-message";
import { FormAlert } from "@/components/ui/States";
import { AGE_COOKIE, AGE_REQUIRED_EVENT } from "@/lib/compliance";

function writeAgeCookie(on: boolean) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = on
    ? `${AGE_COOKIE}=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax${secure}`
    : `${AGE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

/** Ask the age gate to re-open (e.g. the server reported AGE_CONFIRMATION_REQUIRED). */
export function requestAgeConfirmation() {
  writeAgeCookie(false);
  window.dispatchEvent(new Event(AGE_REQUIRED_EVENT));
}

/**
 * 18+ gate. The cookie only avoids re-prompting; the server records the confirmation on
 * the session and enforces it for cart and checkout (403 AGE_CONFIRMATION_REQUIRED).
 */
export function AgeGate({ initiallyConfirmed }: { initiallyConfirmed: boolean }) {
  const t = useTranslations("ageGate");
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(!initiallyConfirmed);
  const [denied, setDenied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useDialog(ref, open, () => undefined, { initialFocus: confirmRef, closeOnEscape: false });

  useEffect(() => {
    const reopen = () => {
      setDenied(false);
      setOpen(true);
    };
    window.addEventListener(AGE_REQUIRED_EVENT, reopen);
    return () => window.removeEventListener(AGE_REQUIRED_EVENT, reopen);
  }, []);

  if (!open) return null;

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await api<void>("/compliance/age-confirmation", { method: "POST", body: { confirmed: true } });
      writeAgeCookie(true);
      setOpen(false);
    } catch (err) {
      setError(`${t("error")} ${errorMessage(err)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] grid place-items-center bg-black/90 p-4 backdrop-blur-sm">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="age-gate-title"
        aria-describedby="age-gate-body"
        className="w-full max-w-[560px] rounded-[10px] border border-primary/60 bg-surface p-6 text-center sm:p-10"
        data-testid="age-gate"
      >
        <Image src="/media/logo.png" alt="Vape Hub" width={190} height={40} className="mx-auto mb-24" />
        {denied ? (
          <>
            <h2 id="age-gate-title" className="h4 mb-16 text-white">
              {t("deniedTitle")}
            </h2>
            <p id="age-gate-body" className="mb-24">
              {t("deniedBody")}
            </p>
            <button type="button" className="cus-btn mx-auto" onClick={() => setDenied(false)}>
              {t("changedMind")}
            </button>
          </>
        ) : (
          <>
            <p className="mb-8 font-heading text-[40px] font-bold text-primary-2" aria-hidden>
              18+
            </p>
            <h2 id="age-gate-title" className="h4 mb-16 text-white">
              {t("title")}
            </h2>
            <p id="age-gate-body" className="mb-24">
              {t("body")}
            </p>
            {error ? (
              <div className="mb-16 text-left">
                <FormAlert tone="error">{error}</FormAlert>
              </div>
            ) : null}
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <button
                ref={confirmRef}
                type="button"
                className="cus-btn is-filled"
                onClick={confirm}
                disabled={pending}
                aria-busy={pending}
                data-testid="age-confirm"
              >
                {pending ? <span className="spinner" aria-hidden /> : null}
                {pending ? t("confirming") : t("confirm")}
              </button>
              <button type="button" className="cus-btn" onClick={() => setDenied(true)} disabled={pending} data-testid="age-exit">
                {t("exit")}
              </button>
            </div>
            <p className="mt-6 text-xs leading-relaxed">{t("legal")}</p>
          </>
        )}
      </div>
    </div>
  );
}
