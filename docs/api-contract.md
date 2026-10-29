# Vape Hub API contract (v1)

One Next.js application serves the storefront and the API from the **same origin**. Server Components read
data through `src/server/storefront.ts` directly; browsers (client components, admin UI) call the Route
Handlers below. Shared TypeScript DTOs live in `src/lib/api/types.ts` and are the source of truth for shapes.

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base path | `/api/v1` (operational: `/api/health`, `/api/ready`) |
| Format | JSON, except uploads (`multipart/form-data`), provider callbacks (provider-defined) and the mock provider page (HTML) |
| Auth | Opaque session id in the `vh_sid` cookie (HttpOnly, SameSite=Lax, Secure in production). `fetch(..., { credentials: "same-origin" })` |
| CSRF | Every `POST/PUT/PATCH/DELETE` needs `X-CSRF-Token` equal to the `vh_csrf` cookie **and** an HMAC bound to the current session, plus an allow-listed `Origin`/`Referer` (`NEXT_PUBLIC_SITE_URL` + `ALLOWED_ORIGINS`). Get a token with `GET /api/v1/auth/csrf` (creates an anonymous session when needed). Responses that rotate the session (`login`, `mfa/verify`, `mfa/activate`, `me/password`) return a new `csrfToken`. On `403 CSRF_INVALID` the client refreshes the token once and retries |
| Locale | Storefront reads accept `?locale=hy|ru|en` (default `hy`, fallback to Armenian content). Admin endpoints return full `{ hy, ru, en }` objects |
| Money | Integer AMD. The client never sends prices or totals |
| Pagination | `page` (1-based), `pageSize` → `meta: { page, pageSize, total, totalPages }` |
| Caching | Public catalog GETs: `public, max-age=30, stale-while-revalidate=120` (only when no cookie is set by the response). Everything else: `no-store` |
| Request id | Every response has `X-Request-Id`; error bodies repeat it |

Success: `{ "data": ..., "meta"?: ... }` (204 has no body).
Error: `{ "error": { "code", "message", "details"?, "requestId" } }`.

| HTTP | code |
| --- | --- |
| 400 | `BAD_REQUEST` (malformed JSON / id) |
| 401 | `UNAUTHENTICATED`, `INVALID_CREDENTIALS` (generic) |
| 403 | `FORBIDDEN`, `MFA_REQUIRED` (`details.mfa = "verify" \| "enroll"`), `CSRF_INVALID`, `ORIGIN_NOT_ALLOWED`, `AGE_CONFIRMATION_REQUIRED` |
| 404 | `NOT_FOUND` (also used for resources the caller may not see) |
| 409 | `OUT_OF_STOCK` (`details: [{ itemId?, sku, requested, available }]`), `CART_EMPTY`, `INVALID_TRANSITION`, `CONFLICT` (`details: [{ path }]`), `IDEMPOTENCY_IN_PROGRESS` |
| 413 / 415 | `PAYLOAD_TOO_LARGE` (JSON > 100 KB, upload > 5 MB) / `UNSUPPORTED_MEDIA_TYPE` |
| 422 | `VALIDATION_FAILED` (`details: [{ path, message }]`), `IDEMPOTENCY_KEY_REUSED` |
| 429 | `RATE_LIMITED` + `Retry-After` |
| 500 | `INTERNAL` (no stack traces) |
| 503 | `SERVICE_UNAVAILABLE`, `PAYMENT_PROVIDER_UNAVAILABLE`, `UPLOADS_NOT_CONFIGURED` |

## 2. Operations

- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/ready` → `200 { "status": "ready", "checks": { "database": "ok" } }` or `503 not_ready`
- `POST /api/v1/cron/run` — `Authorization: Bearer $CRON_SECRET` → `{ data: { expired, sent, failed, orphansRemoved } }`

## 3. Session, compliance

- `GET /auth/csrf` → `{ data: { csrfToken } }`
- `POST /compliance/age-confirmation` `{ "confirmed": true }` → 204. Required before cart mutations and checkout (`403 AGE_CONFIRMATION_REQUIRED`).

## 4. Auth & account

| Route | Body | Result |
| --- | --- | --- |
| `POST /auth/register` | `{ email, password, name, locale }` (unknown fields → 422) | `202 { status: "accepted" }` for new **and** existing emails |
| `POST /auth/login` | `{ email, password }` | `{ user: User, csrfToken, mfa: "none"\|"verify"\|"enroll" }`; session rotated; guest cart merged |
| `POST /auth/logout` | – | 204 |
| `GET /auth/me` | – | `MeResponse { user \| null, session: { mfa, ageConfirmed } }` |
| `PATCH /auth/me` | `{ name?, phone?, locale? }` | `{ user }` |
| `PATCH /auth/me/password` | `{ currentPassword, newPassword }` | `{ csrfToken }` (all other sessions revoked) |
| `POST /auth/forgot-password` | `{ email, locale? }` | 202 always |
| `POST /auth/reset-password` | `{ token, password }` | 204; invalid/expired/reused token → 422 `details[0].path = "token"` |
| `GET /auth/sessions` · `DELETE /auth/sessions/:id` · `POST /auth/sessions/revoke-others` | – | own sessions only |
| `POST /auth/mfa/setup` (admin, not enrolled) | – | `MfaSetupResponse { otpauthUrl, qrDataUrl, secret }` |
| `POST /auth/mfa/activate` | `{ code }` | `{ recoveryCodes: string[10], csrfToken }` |
| `POST /auth/mfa/verify` | `{ code }` or `{ recoveryCode }` | `{ csrfToken }` (TOTP steps cannot be replayed; recovery codes single-use) |
| `POST /auth/mfa/recovery-codes` (admin, verified) | `{ code }` | `{ recoveryCodes }` |
| `GET/POST /account/addresses`, `PATCH/DELETE /account/addresses/:id` | `Address` fields | `Address[]` (max 10, owner-scoped) |

Password policy: 10–128 characters, at least two character classes.

## 5. Catalog (public)

- `GET /products?locale&page&pageSize(≤48)&sort(newest|price-asc|price-desc|popularity)&q&category&brand&flavor&nicotine&minPrice&maxPrice&inStock=true&featured=true` → `ProductCard[]` + meta. CSV for list params; invalid values → 422.
- `GET /products/facets` (same filters) → `Facets` (disjunctive counts: each facet ignores its own filter).
- `GET /products/suggest?q=(2–64)&locale` → `SearchSuggestion[]` (≤ 6, rate-limited).
- `GET /products/:slug?locale` → `ProductDetail` (404 for unknown/draft/archived).
- `GET /categories?locale` → `Category[]` · `GET /brands` → `Brand[]`.

## 6. Cart (session-bound)

`GET /cart?locale&region&coupon` · `POST /cart/items { productId, variantId, quantity }` (201) ·
`PATCH /cart/items/:itemId { quantity }` · `DELETE /cart/items/:itemId` · `DELETE /cart` · `POST /cart/merge` (user).
All return `Cart`. Lines are revalidated on every read (`status: ok | price_changed | insufficient_stock | out_of_stock | unavailable`);
unavailable/out-of-stock lines are excluded from totals. Adding more than is available → `409 OUT_OF_STOCK`.

## 7. Orders

- `POST /orders` with header `Idempotency-Key: <16–64 chars, e.g. UUID>` and `CheckoutRequest` → `201 CheckoutResponse`
  (`200` when replayed with the same key and payload; `422 IDEMPOTENCY_KEY_REUSED` for a different payload).
  Errors: `409 OUT_OF_STOCK` (nothing reserved), `409 CART_EMPTY`, `422`, `403 AGE_CONFIRMATION_REQUIRED`, `503 PAYMENT_PROVIDER_UNAVAILABLE`.
- `GET /orders/my-orders?page&pageSize` (user) → `OrderSummary[]`.
- `GET /orders/:number` → `OrderDetail` (owner user or the guest session that placed it; otherwise 404).
- `POST /orders/:number/cancel` → `OrderDetail` (only `pending | awaiting_payment | payment_failed`).

## 8. Payments

| Route | Notes |
| --- | --- |
| `GET /payments/status/:number` | `PaymentStatusResponse` (same visibility as orders, `no-store`) |
| `POST /payments/{idram\|arca\|mock}/initiate` `{ orderNumber }` | restart payment for an unpaid, unexpired order → `PaymentStatusResponse` |
| `POST /payments/idram/callback` | Idram RESULT_URL (form-urlencoded). Precheck answered `OK`/`NOT OK`; confirmation verified by `EDP_CHECKSUM`. 404 unless `PAYMENT_MODE=live` and Idram env set |
| `GET /payments/arca/callback?orderId=` | customer return; verified by a server-side status call, then 303 → `/{locale}/checkout/success?order=…`. 404 unless configured |
| `POST /payments/mock/callback` | non-production; `X-Mock-Signature: base64url(HMAC-SHA256(MOCK_PAYMENT_SECRET, rawBody))`, body `{ eventId, orderNumber, amount, currency, outcome: succeeded\|failed\|pending }` |
| `GET /payments/mock/checkout/:paymentId` | non-production simulated provider page (HTML) |
| `POST /payments/mock/action` | form target of that page (`paymentId`, `outcome`), then 303 to the storefront status page |

## 9. Content

`GET /blog?locale&page&pageSize&category&q` → `BlogCard[]` · `GET /blog/:slug` → `BlogPost` ·
`POST /contact { name, email, phone?, subject, message, locale, website? }` → `201 { id }` (honeypot `website` must be empty) ·
`POST /newsletter { email, locale }` → 202 · `GET /settings/public?locale` → `PublicSettings`.

## 10. Media

`GET /media/pexels/search?q&page&orientation` (admin) → `PexelsPhoto[]` (503 when `PEXELS_API_KEY` is missing).

## 11. Admin (`/api/v1/admin/*`, role admin + MFA-verified session)

| Area | Routes |
| --- | --- |
| Dashboard | `GET /admin/dashboard` → `AdminDashboard` |
| Products | `GET/POST /admin/products`, `GET/PATCH/DELETE /admin/products/:id` (delete only if never ordered), `POST /admin/products/:id/archive` |
| Variants | `POST /admin/products/:id/variants`, `PATCH /admin/products/:id/variants/:variantId` (no stock field), `DELETE` (deactivates) |
| Inventory | `POST /admin/inventory/adjust { productId, variantId, delta, reason }` → `{ stockBefore, stockAfter }`; `GET /admin/inventory/movements?productId` |
| Taxonomy | `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id`; same for `/admin/brands` |
| Orders | `GET /admin/orders?status&q` (`status=reconciliation` lists flagged orders), `GET /admin/orders/:id` → `AdminOrderDetail` (incl. `allowedTransitions`), `POST /admin/orders/:id/transition { to, note?, confirm? }` (`confirm: true` required for `cancelled`/`refunded`; payment states cannot be set manually) |
| Users | `GET /admin/users`, `PATCH /admin/users/:id { active }`, `POST /admin/users/:id/mfa-reset { code, confirm: true }` (step-up TOTP) |
| Content | `GET/POST /admin/blog`, `PATCH/DELETE /admin/blog/:id`, `GET /admin/contact-messages`, `PATCH /admin/contact-messages/:id { status }` |
| Coupons | `GET/POST /admin/coupons`, `PATCH/DELETE /admin/coupons/:id` |
| Settings | `GET/PUT /admin/settings` (`AdminSettings`: VAT, shipping, reservation TTL, banners, store info) |
| Uploads | `GET /admin/uploads`, `POST /admin/uploads` (multipart field `file`), `DELETE /admin/uploads/:id` |
| Payments | `GET /admin/payments/providers` → `PaymentProviderStatus[]` |
| Audit | `GET /admin/audit-logs?page&action` |

## 12. Test support (never in production)

Active only when `NODE_ENV !== "production"` **and** `E2E_TEST_API_TOKEN` is set; every call needs `X-Test-Token`.
Otherwise every path returns 404.

| Route | Body / query | Result |
| --- | --- | --- |
| `POST /api/v1/test-support/reset` | – | wipe all collections |
| `POST /api/v1/test-support/seed` | – | wipe + deterministic seed → counts |
| `POST /api/v1/test-support/stock` | `{ sku, stock }` | set absolute stock |
| `POST /api/v1/test-support/run-jobs` | – | one job pass |
| `POST /api/v1/test-support/expire-reservations` | `{ orderNumber? }` | force-expire unpaid orders → `{ expired }` |
| `POST /api/v1/test-support/admin` | `{ email, password, name? }` | MFA-enrolled admin → `{ email, totpSecret }` |
| `POST /api/v1/test-support/admin-unenrolled` | `{ email, password }` | admin without MFA (enrolment flow) |
| `POST /api/v1/test-support/totp` | `{ secret }` | `{ code }` current TOTP |
| `GET /api/v1/test-support/emails?to=` | – | captured emails `[{ to, subject, text, template, createdAt }]` |
| `GET /api/v1/test-support/order?number=` | – | `{ status, paymentStatus, reconciliation }` |

## 13. Change process

Shapes change in `src/lib/api/types.ts` together with the Route Handler and this document in the same PR.
Additive changes keep `/api/v1`; breaking changes get `/api/v2` routes. Integration tests in `tests/server`
exercise every route against a real MongoDB replica set, and the Playwright suite exercises the routes the UI uses.
