"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminBanner, AdminSettings } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import { AdminError, adminErrorText, emptyLocalized, ImagesEditor, LocalizedFields, PageTitle, Panel, SaveBar, SelectInput, TextInput, Toggle, useAdminGet } from "../ui";

export function SettingsSection() {
  const q = useAdminGet<AdminSettings>("/admin/settings", ["settings"]);
  if (q.isPending) return <div className="skeleton h-[600px]" aria-busy="true" />;
  if (q.isError) return <AdminError error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />;
  return <SettingsForm initial={q.data} />;
}

function SettingsForm({ initial }: { initial: AdminSettings }) {
  const client = useQueryClient();
  const toast = useToast();
  const [s, setS] = useState(initial);

  const save = useMutation({
    mutationFn: () =>
      api<AdminSettings>("/admin/settings", {
        method: "PUT",
        body: {
          vatRatePercent: Number(s.vatRatePercent),
          shipping: { yerevanFee: Number(s.shipping.yerevanFee), otherFee: Number(s.shipping.otherFee), freeThreshold: Number(s.shipping.freeThreshold) },
          reservationTtlMinutes: Number(s.reservationTtlMinutes),
          store: s.store,
          banners: s.banners.map((b) => ({ title: b.title, subtitle: b.subtitle, image: b.image, link: b.link, placement: b.placement, active: b.active, sortOrder: b.sortOrder })),
        },
      }),
    onSuccess: (saved) => {
      client.setQueryData(["admin", "settings"], saved);
      toast.success("Settings saved. Storefront prices and shipping use the new values immediately.");
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  const setBanner = (i: number, patch: Partial<AdminBanner>) => setS({ ...s, banners: s.banners.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  return (
    <>
      <PageTitle>Settings</PageTitle>
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!save.isPending) save.mutate();
        }}
        data-testid="settings-form"
      >
        {save.isError ? <AdminError error={save.error} /> : null}
        <Panel title="Tax, delivery & reservations">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <TextInput label="VAT rate (%) — prices include VAT" type="number" min={0} max={50} step={0.5} value={s.vatRatePercent} onChange={(v) => setS({ ...s, vatRatePercent: Number(v) })} testId="settings-vat" />
            <TextInput label="Yerevan delivery (AMD)" type="number" min={0} value={s.shipping.yerevanFee} onChange={(v) => setS({ ...s, shipping: { ...s.shipping, yerevanFee: Number(v) } })} testId="settings-yerevan" />
            <TextInput label="Other regions (AMD)" type="number" min={0} value={s.shipping.otherFee} onChange={(v) => setS({ ...s, shipping: { ...s.shipping, otherFee: Number(v) } })} />
            <TextInput label="Free delivery from (AMD, after discount)" type="number" min={0} value={s.shipping.freeThreshold} onChange={(v) => setS({ ...s, shipping: { ...s.shipping, freeThreshold: Number(v) } })} />
            <TextInput label="Online-payment reservation (minutes)" type="number" min={5} max={1440} value={s.reservationTtlMinutes} onChange={(v) => setS({ ...s, reservationTtlMinutes: Number(v) })} />
          </div>
        </Panel>
        <Panel title="Store contact">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput label="Phone" value={s.store.phone} onChange={(phone) => setS({ ...s, store: { ...s.store, phone } })} />
              <TextInput label="Email" type="email" value={s.store.email} onChange={(email) => setS({ ...s, store: { ...s.store, email } })} />
            </div>
            <LocalizedFields label="Address" value={s.store.address} onChange={(address) => setS({ ...s, store: { ...s.store, address } })} />
            <LocalizedFields label="Opening hours" value={s.store.hours} onChange={(hours) => setS({ ...s, store: { ...s.store, hours } })} />
          </div>
        </Panel>
        <Panel
          title="Promotional banners"
          actions={
            <button
              type="button"
              className="cus-btn is-sm"
              onClick={() =>
                setS({
                  ...s,
                  banners: [...s.banners, { id: `new-${Date.now()}`, title: emptyLocalized(), subtitle: emptyLocalized(), image: null, link: "/shop", placement: "promo", active: true, sortOrder: s.banners.length }],
                })
              }
            >
              Add banner
            </button>
          }
        >
          {s.banners.length === 0 ? <p className="text-sm">No banners.</p> : null}
          <div className="space-y-4">
            {s.banners.map((b, i) => (
              <div key={b.id} className="space-y-3 rounded-[10px] border border-white/10 p-3">
                <div className="grid gap-3 md:grid-cols-4">
                  <TextInput label="Link (internal path)" value={b.link} onChange={(link) => setBanner(i, { link })} />
                  <SelectInput label="Placement" value={b.placement} onChange={(v) => setBanner(i, { placement: v as AdminBanner["placement"] })} options={[{ value: "promo", label: "Promo (home banner)" }, { value: "hero", label: "Hero" }]} />
                  <TextInput label="Sort order" type="number" value={b.sortOrder} onChange={(v) => setBanner(i, { sortOrder: Number(v) })} />
                  <div className="flex items-end justify-between gap-3 pb-3">
                    <Toggle label="Active" checked={b.active} onChange={(active) => setBanner(i, { active })} />
                    <button type="button" className="text-danger" onClick={() => setS({ ...s, banners: s.banners.filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                  </div>
                </div>
                <LocalizedFields label="Title" value={b.title} onChange={(title) => setBanner(i, { title })} required />
                <LocalizedFields label="Subtitle" value={b.subtitle} onChange={(subtitle) => setBanner(i, { subtitle })} />
                <ImagesEditor label="Banner image" images={b.image ? [b.image] : []} onChange={(imgs) => setBanner(i, { image: imgs[0] ?? null })} max={1} />
              </div>
            ))}
          </div>
        </Panel>
        <SaveBar pending={save.isPending} label="Save settings" testId="save-settings" />
      </form>
    </>
  );
}
