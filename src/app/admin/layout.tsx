import "../globals.css";
import "./admin.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import en from "../../../messages/en.json";
import { getAuthContext } from "@/server/auth-context";
import { fontVariables } from "../fonts";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "Vape Hub — Admin",
  robots: { index: false, follow: false },
};

/** Admin root layout (English only). Signed-in non-admins get a 404 — the area is not advertised. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await getAuthContext();
  if (user && user.role !== "admin") notFound();
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body className="admin-root" suppressHydrationWarning>
        <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Yerevan">
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
