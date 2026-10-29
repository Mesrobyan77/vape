"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api/client";
import { useErrorMessage } from "@/hooks/use-error-message";
import { Field } from "@/components/forms/Field";
import { FormAlert } from "@/components/ui/States";
import { ArrowRightIcon } from "@/components/icons";

export function ContactForm() {
  const t = useTranslations("contact");
  const tv = useTranslations("validation");
  const locale = useLocale();
  const errorMessage = useErrorMessage();
  const [alert, setAlert] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, tv("required")).max(80, tv("max", { max: 80 })),
        email: z.string().trim().min(1, tv("required")).email(tv("email")),
        phone: z.string().trim().max(30, tv("max", { max: 30 })),
        subject: z.string().trim().min(1, tv("required")).max(120, tv("max", { max: 120 })),
        message: z.string().trim().min(10, tv("min", { min: 10 })).max(4000, tv("max", { max: 4000 })),
        // Honeypot: real people never see or fill this field.
        website: z.string().max(0),
      }),
    [tv],
  );
  type Values = z.infer<typeof schema>;
  const { register, handleSubmit, formState, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", email: "", phone: "", subject: "", message: "", website: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    try {
      await api<{ id: string }>("/contact", { method: "POST", body: { ...values, locale } });
      reset();
      setAlert({ tone: "success", text: t("sent") });
    } catch (err) {
      setAlert({ tone: "error", text: errorMessage(err) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate data-testid="contact-form">
      {alert ? (
        <div className="mb-24">
          <FormAlert tone={alert.tone}>{alert.text}</FormAlert>
        </div>
      ) : null}
      <fieldset disabled={formState.isSubmitting} className="mb-32 grid gap-4 sm:grid-cols-2 lg:gap-6">
        <Field label={t("name")} autoComplete="name" error={formState.errors.name?.message} {...register("name")} />
        <Field label={t("email")} type="email" autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
        <Field label={t("phone")} type="tel" autoComplete="tel" error={formState.errors.phone?.message} {...register("phone")} />
        <Field label={t("subject")} error={formState.errors.subject?.message} {...register("subject")} />
        <div className="sm:col-span-2">
          <Field as="textarea" rows={6} label={t("message")} error={formState.errors.message?.message} {...register("message")} />
        </div>
        <div aria-hidden className="absolute left-[-10000px] h-px w-px overflow-hidden">
          <label htmlFor="contact-website">Website</label>
          <input id="contact-website" tabIndex={-1} autoComplete="off" {...register("website")} />
        </div>
      </fieldset>
      <button type="submit" className="cus-btn" disabled={formState.isSubmitting} aria-busy={formState.isSubmitting} data-testid="contact-submit">
        {formState.isSubmitting ? <span className="spinner" aria-hidden /> : null}
        {formState.isSubmitting ? t("sending") : t("send")}
        {!formState.isSubmitting ? <ArrowRightIcon /> : null}
      </button>
    </form>
  );
}
