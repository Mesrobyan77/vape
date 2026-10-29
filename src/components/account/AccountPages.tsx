"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AccountGate, AccountLayout, GuestAuth } from "./AccountShell";
import { OrderDetailView, OrdersTable } from "./OrdersViews";
import { AddressesView, ProfileView, SecurityView } from "./ProfileViews";

export function AccountHome() {
  const t = useTranslations("account");
  return (
    <AccountGate guest={<GuestAuth />}>
      {(user) => (
        <AccountLayout user={user}>
          <div className="space-y-6">
            <section className="surface p-6" data-testid="account-overview">
              <h2 className="h5 mb-8 text-white">{t("welcome", { name: user.name })}</h2>
              <p>{t("overviewText")}</p>
            </section>
            <section className="surface p-6">
              <div className="mb-16 flex items-center justify-between">
                <h2 className="h6 text-white">{t("recentOrders")}</h2>
                <Link href="/account/orders" className="text-link">
                  {t("orders")}
                </Link>
              </div>
              <OrdersTable limit={3} showPagination={false} />
            </section>
          </div>
        </AccountLayout>
      )}
    </AccountGate>
  );
}

export function AccountOrders() {
  const t = useTranslations("account");
  return (
    <AccountGate>
      {(user) => (
        <AccountLayout user={user}>
          <section className="surface p-6">
            <h2 className="h6 mb-16 text-white">{t("orders")}</h2>
            <OrdersTable />
          </section>
        </AccountLayout>
      )}
    </AccountGate>
  );
}

export function AccountOrderDetail({ number }: { number: string }) {
  return <AccountGate>{(user) => <AccountLayout user={user}>{<OrderDetailView number={number} />}</AccountLayout>}</AccountGate>;
}

export function AccountAddresses() {
  return <AccountGate>{(user) => <AccountLayout user={user}>{<AddressesView />}</AccountLayout>}</AccountGate>;
}

export function AccountProfile() {
  return <AccountGate>{(user) => <AccountLayout user={user}>{<ProfileView user={user} />}</AccountLayout>}</AccountGate>;
}

export function AccountSecurity() {
  return <AccountGate>{(user) => <AccountLayout user={user}>{<SecurityView />}</AccountLayout>}</AccountGate>;
}
