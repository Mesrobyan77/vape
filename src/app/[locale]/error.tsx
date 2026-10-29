"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Link } from "@/i18n/navigation";

export default function LocaleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");
  useEffect(() => {
    // Digest only: the message may contain internals and is never shown to the user.
    console.error("Page error", error.digest ?? "no-digest");
  }, [error]);
  return (
    <section className="py-80" role="alert" data-testid="error-page">
      <div className="container-vh text-center">
        <h1 className="h2 mb-16 text-white">{t("title")}</h1>
        <p className="mx-auto mb-24 max-w-[520px]">{t("body")}</p>
        {error.digest ? <p className="mb-24 text-sm">{t("reference", { id: error.digest })}</p> : null}
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" className="cus-btn is-filled" onClick={reset}>
            {t("retry")}
          </button>
          <Link href="/" className="cus-btn">
            {t("home")}
          </Link>
        </div>
      </div>
    </section>
  );
}
