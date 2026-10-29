"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useRouter as useAppRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Link, useRouter } from "@/i18n/navigation";
import { api, isApiError, setCsrfToken } from "@/lib/api/client";
import type { LoginResponse } from "@/lib/api/types";
import { loginSchema, registerSchema, resetSchema } from "@/lib/auth-schema";
import { useAuthMessages } from "@/hooks/use-auth-messages";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useRefreshSession } from "@/hooks/use-me";
import { ArrowRightIcon } from "@/components/icons";
import { Field } from "@/components/forms/Field";
import { FormAlert } from "@/components/ui/States";

type Alert = { tone: "error" | "success" | "info"; text: string } | null;

function SubmitButton({ pending, label, pendingLabel, testId }: { pending: boolean; label: string; pendingLabel: string; testId?: string }) {
  return (
    <button type="submit" className="cus-btn mx-auto" disabled={pending} aria-busy={pending} data-testid={testId}>
      {pending ? <span className="spinner" aria-hidden /> : null}
      {pending ? pendingLabel : label}
      {!pending ? <ArrowRightIcon /> : null}
    </button>
  );
}

/** Shared post-login handling: rotate CSRF token, refresh session-bound data, route admins to MFA. */
function useCompleteLogin() {
  const refresh = useRefreshSession();
  const router = useRouter();
  const appRouter = useAppRouter();
  return async (result: LoginResponse, next = "/account") => {
    setCsrfToken(result.csrfToken);
    await refresh();
    if (result.user.role === "admin") {
      // The admin area is unlocalized and lives in its own root layout.
      appRouter.push("/admin");
      return;
    }
    router.replace(next);
  };
}

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("account");
  const messages = useAuthMessages();
  const errorMessage = useErrorMessage();
  const complete = useCompleteLogin();
  const [alert, setAlert] = useState<Alert>(null);
  const schema = useMemo(() => loginSchema(messages), [messages]);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), mode: "onTouched" });

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    try {
      const result = await api<LoginResponse>("/auth/login", { method: "POST", body: values });
      await complete(result, next);
    } catch (err) {
      setAlert({ tone: "error", text: isApiError(err) && err.code === "INVALID_CREDENTIALS" ? t("invalidCredentials") : errorMessage(err) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate data-testid="login-form" aria-busy={formState.isSubmitting}>
      {alert ? (
        <div className="mb-24">
          <FormAlert tone={alert.tone}>{alert.text}</FormAlert>
        </div>
      ) : null}
      <fieldset disabled={formState.isSubmitting} className="space-y-6">
        <Field label={t("email")} type="email" autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
        <Field
          label={t("password")}
          type="password"
          autoComplete="current-password"
          error={formState.errors.password?.message}
          {...register("password")}
        />
      </fieldset>
      <div className="mb-24 mt-3 text-end">
        <Link href="/account/forgot-password" className="text-link">
          {t("forgot")}
        </Link>
      </div>
      <SubmitButton pending={formState.isSubmitting} label={t("loginCta")} pendingLabel={t("loggingIn")} testId="login-submit" />
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations("account");
  const locale = useLocale();
  const messages = useAuthMessages();
  const errorMessage = useErrorMessage();
  const complete = useCompleteLogin();
  const [alert, setAlert] = useState<Alert>(null);
  const schema = useMemo(() => registerSchema(messages), [messages]);
  const { register, handleSubmit, formState, setError } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), mode: "onTouched" });

  const onSubmit = handleSubmit(async (values) => {
    setAlert(null);
    try {
      // The response is identical for new and existing emails (no account enumeration).
      await api<{ status: string }>("/auth/register", {
        method: "POST",
        body: { name: values.name, email: values.email, password: values.password, locale },
      });
      setAlert({ tone: "info", text: t("registerAccepted") });
      try {
        const result = await api<LoginResponse>("/auth/login", { method: "POST", body: { email: values.email, password: values.password } });
        await complete(result);
      } catch {
        setAlert({ tone: "info", text: t("registerExisting") });
      }
    } catch (err) {
      if (isApiError(err) && err.code === "VALIDATION_FAILED") {
        for (const detail of err.fieldErrors) {
          if (detail.path === "password" || detail.path === "email" || detail.path === "name") {
            setError(detail.path, { type: "server", message: detail.message });
          }
        }
      }
      setAlert({ tone: "error", text: errorMessage(err) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate data-testid="register-form" aria-busy={formState.isSubmitting}>
      {alert ? (
        <div className="mb-24">
          <FormAlert tone={alert.tone}>{alert.text}</FormAlert>
        </div>
      ) : null}
      <fieldset disabled={formState.isSubmitting} className="mb-48 space-y-6">
        <Field label={t("name")} autoComplete="name" error={formState.errors.name?.message} {...register("name")} />
        <Field label={t("email")} type="email" autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
        <Field
          label={t("createPassword")}
          type="password"
          autoComplete="new-password"
          hint={t("passwordHint")}
          error={formState.errors.password?.message}
          {...register("password")}
        />
        <Field
          label={t("confirmPassword")}
          type="password"
          autoComplete="new-password"
          error={formState.errors.confirm?.message}
          {...register("confirm")}
        />
      </fieldset>
      <SubmitButton pending={formState.isSubmitting} label={t("registerCta")} pendingLabel={t("registering")} testId="register-submit" />
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("account");
  const locale = useLocale();
  const messages = useAuthMessages();
  const errorMessage = useErrorMessage();
  const [alert, setAlert] = useState<Alert>(null);
  const schema = useMemo(() => loginSchema(messages).pick({ email: true }), [messages]);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(schema), mode: "onTouched" });

  const onSubmit = handleSubmit(async ({ email }) => {
    setAlert(null);
    try {
      await api<void>("/auth/forgot-password", { method: "POST", body: { email, locale } });
      setAlert({ tone: "success", text: t("resetSent") });
    } catch (err) {
      setAlert({ tone: "error", text: errorMessage(err) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate data-testid="forgot-form">
      <p className="mb-24">{t("forgotText")}</p>
      {alert ? (
        <div className="mb-24">
          <FormAlert tone={alert.tone}>{alert.text}</FormAlert>
        </div>
      ) : null}
      <fieldset disabled={formState.isSubmitting} className="mb-32">
        <Field label={t("email")} type="email" autoComplete="email" error={formState.errors.email?.message} {...register("email")} />
      </fieldset>
      <SubmitButton pending={formState.isSubmitting} label={t("sendReset")} pendingLabel={t("sending")} />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const t = useTranslations("account");
  const tCommon = useTranslations("common");
  const messages = useAuthMessages();
  const errorMessage = useErrorMessage();
  const [alert, setAlert] = useState<Alert>(null);
  const [done, setDone] = useState(false);
  const schema = useMemo(() => resetSchema(messages), [messages]);
  const { register, handleSubmit, formState } = useForm<{ password: string; confirm: string }>({ resolver: zodResolver(schema), mode: "onTouched" });

  if (!token) {
    return (
      <div className="space-y-6">
        <FormAlert tone="error">{t("resetInvalid")}</FormAlert>
        <Link href="/account/forgot-password" className="cus-btn">
          {t("forgotTitle")}
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-6">
        <FormAlert tone="success">{t("resetDone")}</FormAlert>
        <Link href="/account" className="cus-btn" data-testid="go-to-login">
          {t("goToLogin")}
          <ArrowRightIcon />
        </Link>
      </div>
    );
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setAlert(null);
    try {
      await api<void>("/auth/reset-password", { method: "POST", body: { token, password } });
      setCsrfToken(null);
      setDone(true);
    } catch (err) {
      const invalidToken = isApiError(err) && err.code === "VALIDATION_FAILED" && err.fieldErrors.some((d) => d.path === "token");
      setAlert({ tone: "error", text: invalidToken ? t("resetInvalid") : errorMessage(err) });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate data-testid="reset-form">
      {alert ? (
        <div className="mb-24">
          <FormAlert tone={alert.tone}>{alert.text}</FormAlert>
        </div>
      ) : null}
      <fieldset disabled={formState.isSubmitting} className="mb-32 space-y-6">
        <Field
          label={t("newPassword")}
          type="password"
          autoComplete="new-password"
          hint={t("passwordHint")}
          error={formState.errors.password?.message}
          {...register("password")}
        />
        <Field label={t("confirmPassword")} type="password" autoComplete="new-password" error={formState.errors.confirm?.message} {...register("confirm")} />
      </fieldset>
      <SubmitButton pending={formState.isSubmitting} label={t("resetSubmit")} pendingLabel={tCommon("saving")} />
    </form>
  );
}
