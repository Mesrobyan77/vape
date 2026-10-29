"use client";

import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface Props {
  value: number;
  max: number;
  min?: number;
  disabled?: boolean;
  size?: "md" | "sm";
  onChange: (next: number) => void;
  label?: string;
  id?: string;
}

/** Bordered −/+ stepper from the reference; clamps to [min, max] and announces limits. */
export function QuantityControl({ value, max, min = 1, disabled, size = "md", onChange, label, id }: Props) {
  const t = useTranslations("product");
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  const upper = Math.max(min, Math.min(max, 99));
  const commit = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    const next = Number.isFinite(parsed) ? Math.min(upper, Math.max(min, parsed)) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className={`quantity-wrap ${size === "sm" ? "is-sm" : ""}`} role="group" aria-label={label ?? t("quantity")}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={t("decrease")}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={upper}
        value={draft}
        disabled={disabled}
        aria-label={label ?? t("quantity")}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
          }
        }}
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(upper, value + 1))}
        disabled={disabled || value >= upper}
        aria-label={t("increase")}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
