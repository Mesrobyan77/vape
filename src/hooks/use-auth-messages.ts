"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { AuthMessages } from "@/lib/auth-schema";

export function useAuthMessages(): AuthMessages {
  const tv = useTranslations("validation");
  const ta = useTranslations("account");
  return useMemo(
    () => ({
      required: tv("required"),
      email: tv("email"),
      passwordWeak: tv("passwordWeak"),
      mismatch: ta("passwordsMismatch"),
      max: (max: number) => tv("max", { max }),
    }),
    [tv, ta],
  );
}
