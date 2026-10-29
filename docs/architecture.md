# Architecture

Vape Hub is **one Next.js 16 (App Router) application**: storefront pages, admin UI and the HTTP API run in the
same process and share one origin. MongoDB (Atlas or any replica set) stores all state; Cloudinary stores
admin-uploaded media.

```
Browser ──► Next.js (Node.js runtime)
            ├─ src/app/[locale]/**      storefront pages (Server Components read src/server/storefront.ts directly)
            ├─ src/app/admin/**         admin UI (calls /api/v1/admin/*)
            ├─ src/app/api/**           Route Handlers  →  src/server/http/handler.ts
            │                                                ├─ request id, body/query zod validation (strict)
            │                                                ├─ Origin allow-list + signed double-submit CSRF
            │                                                ├─ rate limits (memory or MongoDB store)
            │                                                ├─ session load + authorization (user / admin + MFA)
            │                                                └─ safe error mapping
            ├─ src/server/services/**   business logic (catalog, cart, orders, inventory, admin, content, media)
            ├─ src/server/payments/**   provider adapters (cod, mock, idram, arca) + verified-event application
            ├─ src/server/models/**     Mongoose schemas + indexes
            ├─ src/server/jobs.ts       background jobs (reservation expiry, outbox, orphan media cleanup)
            └─ src/instrumentation.ts   boot-time config validation + in-process job loop
```

Layering for every API call: **route → handler wrapper (auth/CSRF/validation/rate limit) → service → model**.
Route files contain no business rules; services own pricing, inventory, reservations, checkout, payment and
order-state transitions. `src/lib/pricing.ts` and `src/lib/money.ts` are pure modules shared with the UI.

## Key decisions

| Decision | Why |
| --- | --- |
| Single app, server-side sessions in MongoDB | One origin removes CORS; opaque HttpOnly cookie, immediate revocation, rotation on privilege change |
| Signed double-submit CSRF + Origin check | Defence in depth for cookie-authenticated mutations |
| Embedded variants in `Product` | Atomic `$inc` with `$elemMatch` stock condition on a single document |
| Explicit `Reservation` collection | Every stock hold has an auditable lifecycle; conditional transitions make release/consume exactly-once |
| Transactions for every multi-document change | Checkout, cancellation, expiry, payment application and refunds are all-or-nothing |
| Transactional outbox | Emails / cache revalidation are committed with the business change and delivered at-least-once with dedupe keys; no side effects inside retried transaction callbacks |
| Server Components call services directly | No internal HTTP hop; pages render dynamically from the database |

## Pricing rules

All prices are VAT-inclusive whole AMD. Subtotal → coupon discount (on merchandise) → shipping (`yerevan` fee,
other-marz fee, free when *discounted* subtotal ≥ threshold) → total. VAT portion =
`round_half_up(total × rate / (100 + rate))`. Rate, fees, threshold and reservation TTL are admin settings.

## Checkout & inventory lifecycle

1. Client sends identifiers + quantities only, with an `Idempotency-Key`.
2. Replay check on the unique `(idempotencyScope, idempotencyKey)` index (`requestHash` detects key reuse).
3. Transaction: re-read products, conditional decrement for every line (any failure aborts everything →
   `409 OUT_OF_STOCK`), coupon usage `$inc` with limit condition, create order snapshot, reservations,
   inventory movements, payment record, empty cart, enqueue emails.
4. COD → reservations `consumed`, order `pending`. Online → reservations `active` until
   `reservationExpiresAt`, order `awaiting_payment`; the provider is called **after** commit.
5. Verified payment success → reservations `active → consumed`, order `→ paid` (one transaction, idempotent via
   the unique `PaymentEvent(provider, eventKey)` record).
6. Expiry job claims each overdue order with a conditional status update, flips reservations `active → expired`
   and restores stock only for transitions that actually happened.
7. Late success after expiry → atomic re-reserve; if stock is gone the order is flagged
   `reconciliation.required` (refund path) and never fulfilled automatically. Payments for cancelled orders are
   flagged the same way.

## Background jobs

`runJobsOnce()` (expire reservations → process outbox → hourly orphan-media cleanup) is idempotent and safe to
run concurrently. It runs:
- in-process every 15 s (`JOBS_IN_PROCESS=true`, default outside tests) via `src/instrumentation.ts`;
- via `POST /api/v1/cron/run` (Bearer `CRON_SECRET`) for serverless hosting;
- via `npm run jobs:run [-- --loop]` as a separate worker.

## Localization

Catalogue/blog content is stored as `{ hy, ru, en }` and resolved server-side with fallback to Armenian.
Emails are rendered per order/user locale.
