# Security design & threat model

Scope: the Next.js app (storefront, admin, API), MongoDB, Cloudinary, SMTP, payment providers.

| Threat | Controls (where) |
| --- | --- |
| Customer account takeover | argon2id (`auth/passwords.ts`), 10–128 char policy, generic login errors + timing equalization, per-account lockout (10 failures/15 min) and IP/account rate limits, session rotation on login, revocation on password change/reset |
| Admin account takeover | mandatory TOTP MFA (secret AES-256-GCM encrypted with `MFA_ENCRYPTION_KEY`), replay protection (last accepted step), HMAC-hashed single-use recovery codes, MFA lockout, short admin sessions (2 h idle / 12 h absolute), step-up TOTP for recovery-code regeneration and MFA resets, audit log |
| Session theft / fixation | opaque 256-bit token, only its SHA-256 stored, HttpOnly + SameSite=Lax + Secure (prod) cookies, idle + absolute expiry, new id on login/MFA/password change, server-side revocation |
| CSRF | signed double-submit token bound to the session hash + Origin/Referer allow-list on every mutation (`http/handler.ts`); provider callbacks exempt and authenticated by signature |
| XSS | React escaping; blog/product text stored as plain text; emails HTML-escape all values; strict CSP with nonces (set in `src/proxy.ts` by the UI layer); image URLs restricted to `/media`, Cloudinary or Pexels |
| NoSQL injection | strict zod schemas yield only primitives; unknown fields rejected; regex search input escaped; `strictQuery` |
| Broken access control / IDOR | every private query scoped by user id or guest session hash (`findOrderForViewer`, cart owner, addresses on the user document); 404 instead of 403 for others' resources; admin = role **and** MFA-verified session |
| Mass assignment | `.strict()` schemas everywhere; role never accepted from clients; variant PATCH cannot change stock |
| SSRF | no server-side fetch of user URLs; Pexels/ArCa/Idram hosts fixed in code/config |
| Path traversal | slugs and ids validated by regex/ObjectId before use; no filesystem access from requests |
| File upload abuse | admin-only, 5 MB limit, magic-byte type check (jpeg/png/webp/avif), sharp decode with pixel limit ≤ 6000 px, uploaded server-side to Cloudinary, rate-limited, orphan cleanup |
| Inventory races / overselling | conditional atomic decrements in transactions; all-or-nothing checkout; reservation state machine; concurrency tests A–H |
| Duplicate checkout | required `Idempotency-Key`, unique index, request hash |
| Payment forgery / replay / amount tampering | provider signature/checksum (constant-time) or server-side status check; exact amount/currency/order/merchant match; unique event keys; mismatches audited |
| Refund / cancellation races | conditional status updates inside transactions; refund only `succeeded → refunded` once |
| Brute force / DoS | rate limits on auth, search, contact, newsletter, cart, checkout, payments, uploads, admin (MongoDB store across instances); 100 KB JSON limit; query time limits (`maxTimeMS`); pagination caps |
| Credential / log leakage | env validated without echoing values; logger redacts passwords, tokens, cookies, secrets; health endpoints expose no config |
| Misconfiguration | production refuses missing secrets, http origin, `PAYMENT_MODE=mock`, test token, disabled rate limits |
| Email abuse | enumeration-safe register/forgot (identical 202), rate limits, contact honeypot |
| Dependency vulnerabilities | lockfile, `npm audit --omit=dev --audit-level=high` gate in CI, Dependabot, gitleaks secret scan |
| Unauthorized admin operations | server-side `auth: "admin"` on every admin route, confirmation flag for cancel/refund, audit trail of before/after values |

## Age restriction

The 18+ gate records a self-declaration on the server-side session; cart mutations and checkout are refused without
it, and orders store `ageConfirmed`. This is **not** identity verification. Armenian legal requirements for selling
nicotine products online (age verification at delivery, advertising rules, required warnings) must be reviewed by a
qualified Armenian lawyer before launch.

## Residual risks / follow-ups

- In-memory rate limiting is per-instance; use `RATE_LIMIT_STORE=mongo` (default in production) when scaling out.
- Idram/ArCa adapters are unverified against live providers (see payment-integrations.md).
- Consider WebAuthn for admins and breached-password checks.
