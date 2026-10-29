"use client";

import NextLink from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { api, setCsrfToken } from "@/lib/api/client";
import type { User } from "@/lib/api/types";
import { useMe } from "@/hooks/use-me";
import { useErrorMessage } from "@/hooks/use-error-message";
import { useToast } from "@/components/providers/Toaster";
import { ErrorState } from "@/components/ui/States";
import { LoginForm, RegisterForm } from "./AuthForms";

const SECTIONS = [
  { href: "/account", key: "overview" },
  { href: "/account/orders", key: "orders" },
  { href: "/account/addresses", key: "addresses" },
  { href: "/account/profile", key: "profile" },
  { href: "/account/security", key: "security" },
] as const;

/**
 * Renders `children(user)` only once the session is known to belong to a signed-in user;
 * shows a skeleton meanwhile so private content never flashes for signed-out visitors.
 */
export function AccountGate({ children, guest }: { children: (user: User) => ReactNode; guest?: ReactNode }) {
  const t = useTranslations("account");
  const me = useMe();
  const errorMessage = useErrorMessage();
  const pathname = usePathname();

  if (me.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]" aria-busy="true" data-testid="account-loading">
        <div className="skeleton h-[260px]" />
        <div className="skeleton h-[420px]" />
      </div>
    );
  }
  if (me.isError) return <ErrorState message={errorMessage(me.error)} onRetry={() => me.refetch()} retrying={me.isFetching} />;
  if (!me.data.user) {
    return (
      guest ?? (
        <div className="mx-auto max-w-[560px]">
          <p className="mb-24 text-center text-white" role="status">
            {t("requiresLogin")}
          </p>
          <AuthPanel title={t("login")}>
            <LoginForm next={pathname} />
          </AuthPanel>
        </div>
      )
    );
  }
  return <>{children(me.data.user)}</>;
}

export function AuthPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="surface p-4 sm:p-6">
      <div className="panel-title mb-24 text-center">
        <h2 className="h5 text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function GuestAuth() {
  const t = useTranslations("account");
  return (
    <div className="grid items-start gap-12 md:grid-cols-2 md:gap-6">
      <AuthPanel title={t("signup")}>
        <RegisterForm />
      </AuthPanel>
      <AuthPanel title={t("login")}>
        <LoginForm />
      </AuthPanel>
    </div>
  );
}

export function AccountLayout({ user, children }: { user: User; children: ReactNode }) {
  const t = useTranslations("account");
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await api<void>("/auth/logout", { method: "POST" });
      setCsrfToken(null);
      client.clear();
      router.replace("/account");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label={t("title")} className="surface h-fit p-4">
        <p className="mb-16 truncate font-semibold text-white">{t("welcome", { name: user.name })}</p>
        <ul className="flex flex-wrap gap-2 lg:flex-col">
          {SECTIONS.map((section) => {
            const active = section.href === "/account" ? pathname === "/account" : pathname.startsWith(section.href);
            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-[5px] px-3 py-2 transition-colors ${active ? "bg-primary text-white" : "hover:bg-white/5 hover:text-white"}`}
                >
                  {t(section.key)}
                </Link>
              </li>
            );
          })}
          {user.role === "admin" ? (
            <li>
              <NextLink href="/admin" className="block rounded-[5px] px-3 py-2 text-primary-2 hover:bg-white/5">
                {t("adminArea")}
              </NextLink>
            </li>
          ) : null}
          <li>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="w-full rounded-[5px] px-3 py-2 text-left hover:bg-white/5 hover:text-white"
              data-testid="logout"
            >
              {loggingOut ? t("loggingOut") : t("logout")}
            </button>
          </li>
        </ul>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
