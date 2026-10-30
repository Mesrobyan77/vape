"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import type { AdminBanner, AdminSettings } from "@/lib/api/types";
import { useToast } from "@/components/providers/Toaster";
import {
  AdminError,
  Button,
  emptyLocalized,
  ImagesEditor,
  LocalizedFields,
  PageTitle,
  Panel,
  SaveBar,
  SelectInput,
  TextInput,
  Toggle,
  useAdminGet,
} from "../ui";
import { adminErrorText } from "../ui";

interface Draft {
  vatRatePercent: string;
  yerevanFee: string;
  otherFee: string;
  freeThreshold: string;
  reservationTtlMinutes: string;
  store: AdminSettings["store"];
  banners: AdminBanner[];
}

const str = (n: number) => String(n);

function fromSettings(s: AdminSettings): Draft {
  return {
    vatRatePercent: str(s.vatRatePercent),
    yerevanFee: str(s.shipping.yerevanFee),
    otherFee: str(s.shipping.otherFee),
    freeThreshold: str(s.shipping.freeThreshold),
    reservationTtlMinutes: str(s.reservationTtlMinutes),
    store: s.store,
    banners: s.banners,
  };
}

/** Empty means "not filled in" — it must never silently become 0. */
function parseNum(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function SettingsSection() {
  const q = useAdminGet<AdminSettings>("/admin/settings", ["settings"]);
  if (q.isPending) {
    return (
      <>
        <div className="adm-skeleton mb-4 h-7 w-40" aria-busy="true" />
        <div className="adm-stack">
          <div className="adm-skeleton h-[180px]" />
          <div className="adm-skeleton h-[220px]" />
          <div className="adm-skeleton h-[260px]" />
        </div>
      </>
    );
  }
  if (q.isError || !q.data) {
    return <AdminError error={q.error} onRetry={() => q.refetch()} retrying={q.isFetching} />;
  }
  return <SettingsForm initial={q.data} />;
}

function SettingsForm({ initial }: { initial: AdminSettings }) {
  const client = useQueryClient();
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => fromSettings(initial));
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState(() => JSON.stringify(fromSettings(initial)));
  const dirty = JSON.stringify(d) !== baseline;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useMutation({
    mutationFn: (body: unknown) => api<AdminSettings>("/admin/settings", { method: "PUT", body }),
    onSuccess: (saved) => {
      client.setQueryData(["admin", "settings"], saved);
      setBaseline(JSON.stringify(fromSettings(saved)));
      setLocalErrors({});
      toast.success("Settings saved. Storefront prices and shipping use the new values immediately.");
    },
    onError: (err) => toast.error(adminErrorText(err)),
  });

  const submit = () => {
    const numbers = {
      vatRatePercent: parseNum(d.vatRatePercent),
      yerevanFee: parseNum(d.yerevanFee),
      otherFee: parseNum(d.otherFee),
      freeThreshold: parseNum(d.freeThreshold),
      reservationTtlMinutes: parseNum(d.reservationTtlMinutes),
    };
    const errors: Record<string, string> = {};
    for (const [key, value] of Object.entries(numbers)) {
      if (value === null) errors[key] = "Enter a number, or restore the previous value.";
    }
    if (numbers.vatRatePercent !== null && (numbers.vatRatePercent < 0 || numbers.vatRatePercent > 50)) errors.vatRatePercent = "VAT rate must be between 0 and 50.";
    if (numbers.reservationTtlMinutes !== null && (numbers.reservationTtlMinutes < 5 || numbers.reservationTtlMinutes > 1440)) {
      errors.reservationTtlMinutes = "Reservation must be between 5 and 1440 minutes.";
    }
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Some fields need attention before saving.");
      return;
    }
    save.mutate({
      vatRatePercent: numbers.vatRatePercent,
      shipping: { yerevanFee: numbers.yerevanFee, otherFee: numbers.otherFee, freeThreshold: numbers.freeThreshold },
      reservationTtlMinutes: numbers.reservationTtlMinutes,
      store: d.store,
      banners: d.banners.map((b) => ({ title: b.title, subtitle: b.subtitle, image: b.image, link: b.link, placement: b.placement, active: b.active, sortOrder: b.sortOrder })),
    });
  };

  const setBanner = (i: number, patch: Partial<AdminBanner>) => setD({ ...d, banners: d.banners.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!save.isPending) submit();
      }}
      data-testid="settings-form"
    >
      <PageTitle description="Prices, delivery and compliance copy used by the storefront. Changes apply immediately after saving.">Settings</PageTitle>
      <div className="adm-stack">
        {save.isError ? <AdminError error={save.error} /> : null}
        <Panel title="Tax, delivery & reservations" subtitle="Every amount is in AMD and includes VAT">
          <div className="adm-grid md:grid-cols-3 xl:grid-cols-5">
            <TextInput
              label="VAT rate (%)"
              type="number"
              min={0}
              max={50}
              step={0.5}
              inputMode="decimal"
              value={d.vatRatePercent}
              onChange={(vatRatePercent) => setD({ ...d, vatRatePercent })}
              error={localErrors.vatRatePercent}
              required
              testId="settings-vat"
              hint="Applied to all listed prices."
            />
            <TextInput
              label="Yerevan delivery (AMD)"
              type="number"
              min={0}
              inputMode="numeric"
              value={d.yerevanFee}
              onChange={(yerevanFee) => setD({ ...d, yerevanFee })}
              error={localErrors.yerevanFee}
              required
              testId="settings-yerevan"
            />
            <TextInput
              label="Other regions (AMD)"
              type="number"
              min={0}
              inputMode="numeric"
              value={d.otherFee}
              onChange={(otherFee) => setD({ ...d, otherFee })}
              error={localErrors.otherFee}
              required
            />
            <TextInput
              label="Free delivery from (AMD)"
              type="number"
              min={0}
              inputMode="numeric"
              value={d.freeThreshold}
              onChange={(freeThreshold) => setD({ ...d, freeThreshold })}
              error={localErrors.freeThreshold}
              required
              hint="Measured after the discount."
            />
            <TextInput
              label="Reservation TTL (minutes)"
              type="number"
              min={5}
              max={1440}
              inputMode="numeric"
              value={d.reservationTtlMinutes}
              onChange={(reservationTtlMinutes) => setD({ ...d, reservationTtlMinutes })}
              error={localErrors.reservationTtlMinutes}
              required
              hint="How long online-payment stock is held."
            />
          </div>
        </Panel>
        <Panel title="Store contact" subtitle="Shown in the storefront footer and contact page">
          <div className="adm-stack">
            <div className="adm-grid md:grid-cols-2">
              <TextInput label="Phone" value={d.store.phone} onChange={(phone) => setD({ ...d, store: { ...d.store, phone } })} inputMode="tel" />
              <TextInput label="Email" type="email" value={d.store.email} onChange={(email) => setD({ ...d, store: { ...d.store, email } })} inputMode="email" />
            </div>
            <LocalizedFields label="Address" value={d.store.address} onChange={(address) => setD({ ...d, store: { ...d.store, address } })} />
            <LocalizedFields label="Opening hours" value={d.store.hours} onChange={(hours) => setD({ ...d, store: { ...d.store, hours } })} />
          </div>
        </Panel>
        <Panel
          title="Promotional banners"
          subtitle={`${d.banners.length} banner${d.banners.length === 1 ? "" : "s"} · ordered as shown on the storefront`}
          actions={
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                setD({
                  ...d,
                  banners: [
                    ...d.banners,
                    {
                      id: `new-${Date.now()}`,
                      title: emptyLocalized(),
                      subtitle: emptyLocalized(),
                      image: null,
                      link: "/shop",
                      placement: "promo",
                      active: true,
                      sortOrder: d.banners.length,
                    },
                  ],
                })
              }
              data-testid="add-banner"
            >
              <Plus aria-hidden /> Add banner
            </Button>
          }
        >
          {d.banners.length === 0 ? (
            <p className="adm-hint">No banners. Add one to promote a category on the home page.</p>
          ) : (
            <div className="adm-stack">
              {d.banners.map((b, i) => (
                <div className="adm-fieldset" key={b.id}>
                  <legend>{`${b.placement === "hero" ? "Hero" : "Promo"} · position ${b.sortOrder}`}</legend>
                  <div className="adm-stack">
                    <div className="adm-grid md:grid-cols-4">
                      <TextInput label="Link (internal path)" value={b.link} onChange={(link) => setBanner(i, { link })} hint="For example /shop" />
                      <SelectInput
                        label="Placement"
                        value={b.placement}
                        onChange={(v) => setBanner(i, { placement: v as AdminBanner["placement"] })}
                        options={[
                          { value: "promo", label: "Promo (home banner)" },
                          { value: "hero", label: "Hero" },
                        ]}
                      />
                      <TextInput label="Sort order" type="number" inputMode="numeric" value={str(b.sortOrder)} onChange={(v) => setBanner(i, { sortOrder: Number(v) || 0 })} />
                      <div className="adm-field" style={{ justifyContent: "flex-end" }}>
                        <span className="adm-label" aria-hidden>
                          Visibility
                        </span>
                        <div className="adm-rowactions" style={{ gap: "var(--adm-sp-3)" }}>
                          <Toggle label="Active" checked={b.active} onChange={(active) => setBanner(i, { active })} />
                          <Button variant="quiet" size="sm" onClick={() => setD({ ...d, banners: d.banners.filter((_, j) => j !== i) })} data-testid={`remove-banner-${i}`}>
                            <Trash2 aria-hidden /> Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                    <LocalizedFields label="Title" value={b.title} onChange={(title) => setBanner(i, { title })} required />
                    <LocalizedFields label="Subtitle" value={b.subtitle} onChange={(subtitle) => setBanner(i, { subtitle })} />
                    <ImagesEditor label="Banner image" images={b.image ? [b.image] : []} onChange={(imgs) => setBanner(i, { image: imgs[0] ?? null })} max={1} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <SaveBar pending={save.isPending} label="Save settings" testId="save-settings" dirty={dirty} hint="All values match the server" />
      </div>
    </form>
  );
}
