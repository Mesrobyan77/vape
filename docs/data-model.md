# Data model (MongoDB)

Schemas: `src/server/models/*`. All money fields are integer AMD. Localized fields are `{ hy, ru, en }`.

| Collection | Purpose | Indexes (why) |
| --- | --- | --- |
| `users` | customers & admins, embedded addresses (≤10) and MFA state (encrypted secret, HMAC-hashed recovery codes, last TOTP step) | `email` unique (normalized; uniqueness under concurrency), `role+createdAt` (admin listing) |
| `sessions` | server-side sessions; only `sha256(token)` stored | `tokenHash` unique (lookup), `userId+revokedAt` (revoke all), `expiresAt` TTL (cleanup) |
| `passwordresets` | single-use reset tokens (hash only, 30 min) | `tokenHash` unique, `userId`, `expiresAt` TTL +1 day |
| `categories`, `brands` | taxonomy | `slug` unique, `active+sortOrder` |
| `products` | product + embedded `variants[{ sku, attributes, price, salePrice, stock, images, active }]`; denormalized `minPrice`, `flavors`, `nicotineLevels`, `searchText` recomputed on validate | `slug` unique; `variants.sku` unique multikey (global SKU uniqueness; in-document duplicates rejected in `pre('validate')`); `status+categoryId+createdAt`, `status+brandId`, `status+minPrice`, `status+salesCount`, `status+featured`, `status+flavors`, `status+nicotineLevels` (catalog filters/sorts) |
| `inventorymovements` | append-only stock change log (orders, releases, admin adjustments with before/after, actor, reason) | `productId+createdAt`, `createdAt` |
| `carts` | one per user or guest session; lines store `priceAtAdd` for change detection | `userId` unique partial, `sessionHash` unique partial, `updatedAt` TTL 60 d for guest carts |
| `coupons` | percent/fixed, window, usage limit | `code` unique |
| `settings` | single `key: "store"` doc: VAT, shipping, reservation TTL, banners, store info | `key` unique |
| `orders` | immutable snapshot (items, prices, totals, coupon, pricing metadata, customer, address, locale) + status, timeline, reconciliation flag | `number` unique (human reference); `idempotencyScope+idempotencyKey` unique (idempotent checkout); `userId+createdAt` (history); `sessionHash+createdAt` (guest access); `status+createdAt` (admin, expiry scan); `reconciliation.required` |
| `reservations` | stock holds: `active → consumed / released / expired` | `orderId+variantId` unique (no duplicate holds on retry); `status+expiresAt` (expiry scan); `sku+status` |
| `paymenttransactions` | one per payment attempt, status history, provider reference, last redirect | `orderId+attempt` unique; `provider+providerRef` unique partial (provider references never shared); `orderNumber` |
| `paymentevents` | verified callback receipts (sanitized summary) | `provider+eventKey` unique (duplicate callbacks collapse) |
| `outboxes` | transactional outbox for emails / revalidation | `dedupeKey` unique (exactly-once enqueue); `status+nextAttemptAt` (claiming) |
| `capturedemails` | dev/test inbox when SMTP is not configured (never used in production) | `to+createdAt` |
| `auditlogs` | admin and security events (redacted) | `createdAt`, `action+createdAt`, `targetType+targetId` |
| `blogposts`, `contactmessages`, `newslettersubscriptions` | content | `slug` unique; `status+publishedAt`; `email` unique for newsletter |
| `media` | Cloudinary uploads (public id, size, uploader, soft delete) | `publicId` unique, `deletedAt+createdAt` (orphan cleanup) |
| `ratelimithits` | shared fixed-window counters (`RATE_LIMIT_STORE=mongo`) | `resetAt` TTL |

## Transaction boundaries

| Operation | Documents changed atomically |
| --- | --- |
| Checkout | product stock (per line, conditional), coupon usage, order, reservations, inventory movements, payment transaction, cart, outbox events |
| Payment success | payment event receipt, reservations (`active→consumed`), order (`→paid`), payment transaction, outbox |
| Late success after expiry | payment event, product stock (re-reserve, conditional), reservations, order, payment — or the reconciliation flag |
| Cancellation | order (conditional on allowed source status), reservations released + stock restored per successful transition, payment, outbox, audit |
| Reservation expiry | order claim (conditional), reservations `active→expired` + stock restore, payment, outbox |
| Refund | payment `succeeded→refunded` (conditional, exactly once), order, optional restock, outbox, audit |
| Admin inventory adjustment | product stock (`$inc` with non-negative condition), movement, audit |

Transactions use `readConcern: snapshot`, `writeConcern: majority`, and bounded retry (6 attempts with jittered
backoff) on `TransientTransactionError` / `UnknownTransactionCommitResult` / write conflicts. A replica set is
required (Atlas clusters are replica sets; local dev uses `mongodb-memory-server`).
