# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the store operator (security contact configured for the
deployment) — do not open public issues. Include steps to reproduce and the affected URL/route. We aim to
acknowledge within 3 business days.

## Supported versions

Only the `main` branch / latest deployment receives fixes.

## Practices

- Secrets live only in environment variables / the hosting secret manager; `.env*` files are git-ignored
  (`.env.example` holds placeholders only). CI runs gitleaks.
- Dependencies are pinned by `package-lock.json`, monitored by Dependabot, and CI fails on high/critical
  advisories in production dependencies (`npm audit --omit=dev --audit-level=high`). Development-only advisories
  are reviewed and documented.
- Design and threat model: [docs/security.md](docs/security.md). Payments: [docs/payment-integrations.md](docs/payment-integrations.md).
