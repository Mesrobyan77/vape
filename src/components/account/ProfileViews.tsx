"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { usePathname, useRouter } from "@/i18n/navigation";
import { api, isApiError, setCsrfToken } from "@/lib/api/client";
import { LOCALES, type Address, type Locale, type SessionInfo, type User } from "@/lib/api/types";
import { isStrongPassword } from "@/lib/auth-schema";
import { normalizeArmenianPhone } from "@/lib/checkout-schema";
import { ME_KEY } from "@/hooks/use-me";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useToast } from "@/components/providers/Toaster";
import { useSettings } from "@/components/providers/SettingsProvider";
import { CheckboxField, Field } from "@/components/forms/Field";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState, ErrorState, FormAlert } from "@/components/ui/States";

function Panel({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="surface p-6">
      <h2 className="h6 mb-8 text-white">{title}</h2>
      {description ? <p className="mb-24 text-sm">{description}</p> : <div className="mb-16" />}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- profile */

export function ProfileView({ user }: { user: User }) {
  const t = useTranslations("account");
  const tv = useTranslations("validation");
  const tLang = useTranslations("languages");
  const client = useQueryClient();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const pathname = usePathname();
  const schema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, tv("required")).max(80, tv("max", { max: 80 })),
        phone: z
          .string()
          .trim()
          .refine((v) => v === "" || normalizeArmenianPhone(v) !== null, tv("phone")),
        locale: z.enum(LOCALES),
      }),
    [tv],
  );
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name, phone: user.phone, locale: user.locale },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await api<{ user: User }>("/auth/me", {
        method: "PATCH",
        body: { name: values.name, phone: values.phone ? (normalizeArmenianPhone(values.phone) ?? values.phone) : "", locale: values.locale },
      });
      client.setQueryData(ME_KEY, (prev: { user: User | null; session: unknown } | undefined) => (prev ? { ...prev, user: result.user } : prev));
      toast.success(t("profileSaved"));
      if (values.locale !== user.locale) router.replace(pathname, { locale: values.locale as Locale });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  return (
    <Panel title={t("profile")}>
      <form onSubmit={onSubmit} noValidate className="max-w-[560px] space-y-6" data-testid="profile-form">
        <fieldset disabled={formState.isSubmitting} className="space-y-6">
          <Field label={t("name")} autoComplete="name" error={formState.errors.name?.message} {...register("name")} />
          <Field label={t("email")} value={user.email} readOnly disabled />
          <Field label={t("phone")} type="tel" autoComplete="tel" error={formState.errors.phone?.message} {...register("phone")} />
          <div className="form-group">
            <label htmlFor="profile-locale" className="field-label">
              {t("language")}
            </label>
            <select id="profile-locale" {...register("locale")}>
              {LOCALES.map((l) => (
                <option key={l} value={l}>
                  {tLang(l)}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        <button type="submit" className="cus-btn" disabled={formState.isSubmitting} aria-busy={formState.isSubmitting}>
          {formState.isSubmitting ? <span className="spinner" aria-hidden /> : null}
          {t("saveProfile")}
        </button>
      </form>
    </Panel>
  );
}

/* ------------------------------------------------------------ security */

export function SecurityView() {
  const t = useTranslations("account");
  const tv = useTranslations("validation");
  const format = useFormatter();
  const client = useQueryClient();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [alert, setAlert] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, tv("required")),
          newPassword: z.string().refine(isStrongPassword, tv("passwordWeak")),
          confirm: z.string().min(1, tv("required")),
        })
        .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: t("passwordsMismatch") }),
    [tv, t],
  );
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), mode: "onTouched" });

  const sessions = useQuery({ queryKey: ["sessions"], queryFn: ({ signal }) => api<SessionInfo[]>("/auth/sessions", { signal }) });
  const revoke = useMutation({
    mutationFn: (id: string) => api<void>(`/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("revoked"));
      void client.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const revokeOthers = useMutation({
    mutationFn: () => api<void>("/auth/sessions/revoke-others", { method: "POST", body: {} }),
    onSuccess: () => {
      toast.success(t("revoked"));
      void client.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setAlert(null);
    try {
      const result = await api<{ csrfToken: string }>("/auth/me/password", {
        method: "PATCH",
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      setCsrfToken(result.csrfToken);
      form.reset();
      setAlert({ tone: "success", text: t("passwordChanged") });
      void client.invalidateQueries({ queryKey: ["sessions"] });
    } catch (err) {
      if (isApiError(err) && err.code === "INVALID_CREDENTIALS") {
        form.setError("currentPassword", { type: "server", message: t("invalidCredentials") });
      }
      setAlert({ tone: "error", text: errorMessage(err) });
    }
  });

  return (
    <div className="space-y-6">
      <Panel title={t("changePassword")}>
        {alert ? (
          <div className="mb-24">
            <FormAlert tone={alert.tone}>{alert.text}</FormAlert>
          </div>
        ) : null}
        <form onSubmit={onSubmit} noValidate className="max-w-[560px]" data-testid="password-form">
          <fieldset disabled={form.formState.isSubmitting} className="mb-24 space-y-6">
            <Field
              label={t("currentPassword")}
              type="password"
              autoComplete="current-password"
              error={form.formState.errors.currentPassword?.message}
              {...form.register("currentPassword")}
            />
            <Field
              label={t("newPassword")}
              type="password"
              autoComplete="new-password"
              hint={t("passwordHint")}
              error={form.formState.errors.newPassword?.message}
              {...form.register("newPassword")}
            />
            <Field
              label={t("confirmPassword")}
              type="password"
              autoComplete="new-password"
              error={form.formState.errors.confirm?.message}
              {...form.register("confirm")}
            />
          </fieldset>
          <button type="submit" className="cus-btn" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <span className="spinner" aria-hidden /> : null}
            {t("changePassword")}
          </button>
        </form>
      </Panel>

      <Panel title={t("sessions")} description={t("sessionsText")}>
        {sessions.isPending ? (
          <div className="skeleton h-24" aria-busy="true" />
        ) : sessions.isError ? (
          <ErrorState compact message={errorMessage(sessions.error)} onRetry={() => sessions.refetch()} retrying={sessions.isFetching} />
        ) : (
          <>
            <ul className="mb-24 divide-y divide-white/10" data-testid="sessions-list">
              {sessions.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-white">{s.userAgent || "—"}</span>
                    <span className="block text-sm">{format.dateTime(new Date(s.lastSeenAt), { dateStyle: "medium", timeStyle: "short" })}</span>
                  </span>
                  {s.current ? (
                    <span className="badge is-light">{t("currentSession")}</span>
                  ) : (
                    <button type="button" className="cus-btn is-sm" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)}>
                      {t("revoke")}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {sessions.data.some((s) => !s.current) ? (
              <button type="button" className="cus-btn is-sm is-danger" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
                {revokeOthers.isPending ? <span className="spinner" aria-hidden /> : null}
                {t("revokeOthers")}
              </button>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  );
}

/* ----------------------------------------------------------- addresses */

const emptyAddress = { label: "", fullName: "", phone: "", region: "", city: "", line1: "", line2: "", notes: "", isDefault: false };

export function AddressesView() {
  const t = useTranslations("account");
  const tCheckout = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const tv = useTranslations("validation");
  const settings = useSettings();
  const client = useQueryClient();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const regions = useMemo(() => settings?.regions ?? [], [settings]);

  const addresses = useQuery({ queryKey: ["addresses"], queryFn: ({ signal }) => api<Address[]>("/account/addresses", { signal }) });

  const schema = useMemo(
    () =>
      z.object({
        label: z.string().trim().max(40, tv("max", { max: 40 })),
        fullName: z.string().trim().min(1, tv("required")).max(120, tv("max", { max: 120 })),
        phone: z
          .string()
          .trim()
          .refine((v) => normalizeArmenianPhone(v) !== null, tv("phone")),
        region: z.string().refine((v) => regions.some((r) => r.code === v), tv("region")),
        city: z.string().trim().min(1, tv("required")).max(80, tv("max", { max: 80 })),
        line1: z.string().trim().min(1, tv("required")).max(160, tv("max", { max: 160 })),
        line2: z.string().trim().max(160, tv("max", { max: 160 })),
        notes: z.string().trim().max(300, tv("max", { max: 300 })),
        isDefault: z.boolean(),
      }),
    [tv, regions],
  );
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: emptyAddress });

  const startEdit = (address: Address | "new") => {
    setEditing(address);
    form.reset(address === "new" ? emptyAddress : { ...address });
  };

  const save = form.handleSubmit(async (values) => {
    const body = { ...values, phone: normalizeArmenianPhone(values.phone) ?? values.phone };
    try {
      if (editing === "new") await api<Address>("/account/addresses", { method: "POST", body });
      else if (editing) await api<Address>(`/account/addresses/${encodeURIComponent(editing.id)}`, { method: "PATCH", body });
      toast.success(t("addressSaved"));
      setEditing(null);
      await client.invalidateQueries({ queryKey: ["addresses"] });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<void>(`/account/addresses/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success(t("addressDeleted"));
      setDeleting(null);
      await client.invalidateQueries({ queryKey: ["addresses"] });
    },
    onError: (err) => {
      setDeleting(null);
      toast.error(errorMessage(err));
    },
  });

  return (
    <Panel title={t("addresses")}>
      {addresses.isPending ? (
        <div className="skeleton h-32" aria-busy="true" />
      ) : addresses.isError ? (
        <ErrorState compact message={errorMessage(addresses.error)} onRetry={() => addresses.refetch()} retrying={addresses.isFetching} />
      ) : (
        <>
          {addresses.data.length === 0 && editing === null ? <EmptyState title={t("noAddresses")} /> : null}
          <ul className="mb-24 grid gap-4 md:grid-cols-2" data-testid="addresses-list">
            {addresses.data.map((address) => (
              <li key={address.id} className="rounded-[10px] border border-white/10 p-4">
                <p className="mb-8 flex items-center gap-2 font-semibold text-white">
                  {address.label || address.fullName}
                  {address.isDefault ? <span className="badge is-light">{t("default")}</span> : null}
                </p>
                <p className="mb-16 text-sm leading-relaxed">
                  {address.fullName}, {address.phone}
                  <br />
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                  <br />
                  {address.city}, {regions.find((r) => r.code === address.region)?.name ?? address.region}
                </p>
                <div className="flex gap-3">
                  <button type="button" className="text-link" onClick={() => startEdit(address)}>
                    {tCommon("edit")}
                  </button>
                  <button type="button" className="text-link !text-danger" onClick={() => setDeleting(address)}>
                    {tCommon("delete")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {editing === null ? (
            <button type="button" className="cus-btn" onClick={() => startEdit("new")} disabled={addresses.data.length >= 10} data-testid="add-address">
              {t("addAddress")}
            </button>
          ) : (
            <form onSubmit={save} noValidate className="space-y-6 border-t border-white/10 pt-6" data-testid="address-form">
              <h3 className="h6 text-white">{editing === "new" ? t("addAddress") : t("editAddress")}</h3>
              <fieldset disabled={form.formState.isSubmitting} className="grid gap-4 sm:grid-cols-2">
                <Field label={t("addressLabel")} error={form.formState.errors.label?.message} {...form.register("label")} />
                <Field label={t("fullName")} autoComplete="name" error={form.formState.errors.fullName?.message} {...form.register("fullName")} />
                <Field label={tCheckout("phone")} type="tel" autoComplete="tel" error={form.formState.errors.phone?.message} {...form.register("phone")} />
                <div className="form-group">
                  <label htmlFor="address-region" className="field-label">
                    {tCheckout("region")}
                  </label>
                  <select id="address-region" {...form.register("region")} aria-invalid={Boolean(form.formState.errors.region)}>
                    <option value="">{tCheckout("regionPlaceholder")}</option>
                    {regions.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.region ? <p className="field-error">{form.formState.errors.region.message}</p> : null}
                </div>
                <Field label={tCheckout("city")} error={form.formState.errors.city?.message} {...form.register("city")} />
                <Field label={tCheckout("address1")} error={form.formState.errors.line1?.message} {...form.register("line1")} />
                <Field label={tCheckout("address2")} error={form.formState.errors.line2?.message} {...form.register("line2")} />
                <Field label={tCheckout("notes")} error={form.formState.errors.notes?.message} {...form.register("notes")} />
                <CheckboxField label={t("makeDefault")} className="sm:col-span-2" {...form.register("isDefault")} />
              </fieldset>
              <div className="flex gap-3">
                <button type="submit" className="cus-btn is-filled" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? <span className="spinner" aria-hidden /> : null}
                  {tCommon("save")}
                </button>
                <button type="button" className="cus-btn" onClick={() => setEditing(null)} disabled={form.formState.isSubmitting}>
                  {tCommon("cancel")}
                </button>
              </div>
            </form>
          )}
        </>
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t("deleteAddressConfirm")}
        confirmLabel={tCommon("delete")}
        pending={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </Panel>
  );
}
