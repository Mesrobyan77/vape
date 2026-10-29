import type { ApiErrorCode, ApiErrorDetail } from "@/lib/api/types";

export type ErrorCode = ApiErrorCode;

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  MFA_REQUIRED: 403,
  CSRF_INVALID: 403,
  ORIGIN_NOT_ALLOWED: 403,
  AGE_CONFIRMATION_REQUIRED: 403,
  NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  CART_EMPTY: 409,
  INVALID_TRANSITION: 409,
  CONFLICT: 409,
  IDEMPOTENCY_IN_PROGRESS: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_FAILED: 422,
  IDEMPOTENCY_KEY_REUSED: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
  PAYMENT_PROVIDER_UNAVAILABLE: 503,
  UPLOADS_NOT_CONFIGURED: 503,
};

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: "The request could not be understood.",
  UNAUTHENTICATED: "Please sign in to continue.",
  INVALID_CREDENTIALS: "The email or password is incorrect.",
  FORBIDDEN: "You do not have permission to perform this action.",
  MFA_REQUIRED: "Multi-factor authentication is required.",
  CSRF_INVALID: "Your security token expired. Please retry.",
  ORIGIN_NOT_ALLOWED: "Request origin is not allowed.",
  AGE_CONFIRMATION_REQUIRED: "Please confirm that you are at least 18 years old.",
  NOT_FOUND: "The requested resource was not found.",
  OUT_OF_STOCK: "Some items are no longer available in the requested quantity.",
  CART_EMPTY: "Your cart is empty.",
  INVALID_TRANSITION: "This status change is not allowed.",
  CONFLICT: "The resource conflicts with an existing one.",
  IDEMPOTENCY_IN_PROGRESS: "This request is still being processed. Please retry shortly.",
  PAYLOAD_TOO_LARGE: "The request is too large.",
  UNSUPPORTED_MEDIA_TYPE: "This file type is not supported.",
  VALIDATION_FAILED: "Some fields are invalid.",
  IDEMPOTENCY_KEY_REUSED: "This idempotency key was already used for a different request.",
  RATE_LIMITED: "Too many requests. Please try again later.",
  INTERNAL: "Something went wrong. Please try again.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
  PAYMENT_PROVIDER_UNAVAILABLE: "This payment method is not available right now.",
  UPLOADS_NOT_CONFIGURED: "Media uploads are not configured.",
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: ApiErrorDetail[] | Record<string, unknown>,
  ) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.status = STATUS[code];
  }
}

export const statusFor = (code: ErrorCode): number => STATUS[code];
export const defaultMessage = (code: ErrorCode): string => DEFAULT_MESSAGES[code];

export const notFound = (message?: string) => new AppError("NOT_FOUND", message);
export const forbidden = (message?: string) => new AppError("FORBIDDEN", message);
export const unauthenticated = () => new AppError("UNAUTHENTICATED");
export const validationError = (details: ApiErrorDetail[], message?: string) => new AppError("VALIDATION_FAILED", message, details);

export function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/** Maps any thrown value to a safe AppError (never leaks internals). */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (isDuplicateKeyError(err)) {
    const keyPattern = (err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {};
    return new AppError("CONFLICT", undefined, Object.keys(keyPattern).map((path) => ({ path })));
  }
  if (typeof err === "object" && err !== null) {
    const name = (err as { name?: string }).name;
    if (name === "CastError" || name === "BSONError") return new AppError("BAD_REQUEST");
    if (name === "ValidationError") {
      const errors = (err as { errors?: Record<string, { message?: string }> }).errors ?? {};
      return new AppError(
        "VALIDATION_FAILED",
        undefined,
        Object.entries(errors).map(([path, e]) => ({ path, message: e.message ?? "invalid" })),
      );
    }
    if (name === "MongooseServerSelectionError" || name === "MongoServerSelectionError") return new AppError("SERVICE_UNAVAILABLE");
  }
  return new AppError("INTERNAL");
}
