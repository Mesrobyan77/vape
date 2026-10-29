"use client";

import { useTranslations } from "next-intl";
import { useCallback } from "react";
import { isApiError } from "@/lib/api/client";
import type { ApiErrorCode } from "@/lib/api/types";

const KNOWN: ReadonlySet<string> = new Set<ApiErrorCode>([
  "BAD_REQUEST",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "FORBIDDEN",
  "MFA_REQUIRED",
  "CSRF_INVALID",
  "ORIGIN_NOT_ALLOWED",
  "AGE_CONFIRMATION_REQUIRED",
  "NOT_FOUND",
  "OUT_OF_STOCK",
  "CART_EMPTY",
  "INVALID_TRANSITION",
  "CONFLICT",
  "IDEMPOTENCY_IN_PROGRESS",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "VALIDATION_FAILED",
  "IDEMPOTENCY_KEY_REUSED",
  "RATE_LIMITED",
  "INTERNAL",
  "SERVICE_UNAVAILABLE",
  "PAYMENT_PROVIDER_UNAVAILABLE",
  "UPLOADS_NOT_CONFIGURED",
]);

/** Maps any thrown value to a localized, user-safe message. */
export function useErrorMessage(): (error: unknown) => string {
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");
  return useCallback(
    (error: unknown) => {
      if (isApiError(error)) {
        if (error.code === "NETWORK") {
          return typeof navigator !== "undefined" && !navigator.onLine ? tCommon("offline") : tCommon("networkError");
        }
        if (error.code === "TIMEOUT" || error.code === "ABORTED") return tCommon("networkError");
        if (KNOWN.has(error.code)) return tErrors(error.code as ApiErrorCode);
      }
      return tCommon("genericError");
    },
    [tErrors, tCommon],
  );
}
