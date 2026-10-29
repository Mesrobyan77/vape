"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ArrowRightIcon } from "@/components/icons";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function NewsletterForm() {
  const t = useTranslations("newsletter");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (state === "loading") return;
    if (!EMAIL.test(email.trim())) {
      setState("error");
      setMessage(t("invalid"));
      return;
    }
    setState("loading");
    setMessage(null);
    try {
      await api<void>("/newsletter", { method: "POST", body: { email: email.trim(), locale } });
      setState("success");
      setMessage(t("success"));
      setEmail("");
    } catch (err) {
      setState("error");
      setMessage(errorMessage(err));
    }
  };

  return (
    <form onSubmit={submit} noValidate aria-describedby={message ? `${id}-msg` : undefined}>
      <label htmlFor={`${id}-email`} className="sr-only">
        {t("label")}
      </label>
      <div className="newsletter-field">
        <input
          id={`${id}-email`}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("placeholder")}
          aria-invalid={state === "error"}
        />
        <button type="submit" disabled={state === "loading"} aria-busy={state === "loading"}>
          {state === "loading" ? t("submitting") : t("submit")}
          {state === "loading" ? <span className="spinner" aria-hidden /> : <ArrowRightIcon />}
        </button>
      </div>
      <p
        id={`${id}-msg`}
        role={state === "error" ? "alert" : "status"}
        className={`mt-3 min-h-[1.4em] text-sm font-semibold ${state === "error" ? "text-[#ffd2d2]" : "text-white"}`}
      >
        {message}
      </p>
    </form>
  );
}
