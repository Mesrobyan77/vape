# Deployment & operations

## Requirements

- Node.js ≥ 20.19 (tested on 24), npm.
- MongoDB **replica set** (transactions). MongoDB Atlas (any tier) qualifies.
- Optional: Cloudinary (admin uploads), SMTP (emails), Pexels key, Idram/ArCa merchant credentials.

## Environment (see `.env.example`)

Required in production: `NODE_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://…`, `MONGODB_URI`, `MONGODB_DB_NAME`,
`SESSION_SECRET` (≥ 32 random chars), `MFA_ENCRYPTION_KEY` (`openssl rand -base64 32`).
Recommended: `SMTP_*`, `ADMIN_NOTIFY_EMAIL`, `CRON_SECRET`, `CLOUDINARY_*`, `RATE_LIMIT_STORE=mongo` (default in prod).
Never set in production: `E2E_TEST_API_TOKEN`, `PAYMENT_MODE=mock`, `RATE_LIMIT_DISABLED` (startup fails).
Keep secrets in the host's secret manager (Vercel/Render/Fly environment secrets, AWS Secrets Manager, …), never in Git.

## MongoDB Atlas

1. Create a cluster (replica set by default) in a region close to the app.
2. Create a dedicated database user with `readWrite` on the app database only (no `atlasAdmin`).
3. Network access: allow only the app's egress IPs / private endpoint; never `0.0.0.0/0` in production.
4. Use the `mongodb+srv://` URI (TLS is enforced by Atlas).
5. Indexes are created by Mongoose on startup (`autoIndex`); for large datasets build them ahead of deploys.
6. Backups: enable continuous cloud backup (point-in-time). Retention ≥ 7 days daily + 4 weekly. Backups are
   encrypted at rest by Atlas.
7. **Restore test (quarterly):** restore the latest snapshot to a temporary cluster, point a staging deploy at it,
   run `GET /api/ready` and a COD test order, record duration and data checks, then delete the temp cluster.

## Hosting

### Node server (VM / container / Render / Fly)
```
npm ci
npm run build
npm start               # next start -p 3000
```
Background jobs run in-process (`JOBS_IN_PROCESS` defaults to true). With several instances this is still safe
(jobs use atomic claims) but you may prefer one worker: set `JOBS_IN_PROCESS=false` on web instances and run
`npm run jobs:run -- --loop` as a separate process.

### Serverless (e.g. Vercel)
Set `JOBS_IN_PROCESS=false` and schedule `POST https://{site}/api/v1/cron/run` with header
`Authorization: Bearer $CRON_SECRET` every minute (reservation expiry precision = cron interval).

Put the app behind HTTPS (HSTS is sent in production). `TRUST_PROXY_HEADERS=true` (default) uses
`X-Forwarded-For` for rate limits — make sure your proxy overwrites that header.

## Admin bootstrap

For a development database, put `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the ignored `.env.local` file before
running `npm run seed:dev`. The seed resets the target database, then creates that admin; the password must
be at least 14 characters and meet the password policy. Sign in at `/admin` to enrol TOTP. This seed command
refuses production and must not be used to bootstrap a production account.

For production, create the first administrator explicitly:

```
ADMIN_PASSWORD='…' npm run admin:create -- --email owner@example.am --name "Store Owner"
```
Then sign in at `/admin` and enrol TOTP; store the recovery codes offline. Lost MFA: another admin resets it
(`POST /api/v1/admin/users/:id/mfa-reset` with their own fresh TOTP code); a sole admin with no recovery codes must
reset `mfa` fields directly in the database and re-enrol (audit the event).

## Monitoring

- Liveness `GET /api/health`, readiness `GET /api/ready` (database ping only, no config disclosed).
- Logs are structured JSON on stdout with secrets redacted; ship them to your log platform.
- Watch: `outboxes` documents with `status: "dead"` (failed emails), orders with `reconciliation.required`
  (admin filter `status=reconciliation`), `awaiting_payment` count, 5xx rate.

## Secret rotation

| Secret | Procedure |
| --- | --- |
| `SESSION_SECRET` | rotate → existing CSRF tokens become invalid (clients refresh automatically); sessions stay valid |
| `MFA_ENCRYPTION_KEY` | requires re-encrypting `users.mfa.secretEnc` (decrypt with old, encrypt with new) or forcing admins to re-enrol; recovery-code hashes also depend on it |
| MongoDB password | create a new DB user, deploy with the new URI, delete the old user |
| Cloudinary / SMTP / Pexels / provider keys | rotate in the provider console, update the secret, redeploy |
| `CRON_SECRET`, `MOCK_PAYMENT_SECRET` | change and redeploy (update the scheduler header) |

If any credential was ever pasted into a chat, ticket or repository, rotate it.
