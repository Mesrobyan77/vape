# Admin Panel — Redesign Report

Date: 2026-10-30 · Scope: `/admin` of the Vape Hub Next.js app
Baseline: commit `911823e` · Preceded by: [docs/audits/admin-panel-ux-ui-audit.md](./admin-panel-ux-ui-audit.md) (40 findings, AD-01…AD-40)

---

## 1. What was delivered

The admin panel was rebuilt on its own light design system, scoped entirely to `/admin`; the storefront's dark marketing system in `globals.css` is untouched. All 15 sections, the shell, the auth screens and the shared kit were rewritten for presentation while every API call, query key, validation rule, permission check and route was preserved.

| Layer | Before | After |
| --- | --- | --- |
| Stylesheet | none of its own (inherited `globals.css`) | `src/app/admin/admin.css`, ~1,150 lines, scoped to `body.admin-root` |
| Tokens | storefront `--color-*`, viewport-clamped type | 60+ `--adm-*` tokens: surfaces, text, lines, accent, semantics, radius, elevation, type, density, motion |
| Shell | 15 flat links, no header | grouped sidebar (5 groups, icons, badges, collapsible rail, mobile drawer), sticky topbar with breadcrumbs + user menu, skip link |
| Primitives | 4 status styles, 4 editor patterns, 2 broken dialogs | 1 `StatusPill`, 1 `AdminDialog`/`AdminConfirm`, 1 `EmptyState`, 1 skeleton, `Button`, `Toolbar`, `SearchField`, `Pager` |
| List state | component state, lost on navigation | mirrored into the query string on every list |
| Long forms | save button at the bottom, silent data loss | sticky save bar with dirty state + `beforeunload` guard |

---

## 2. Design system

**Colour.** Canvas `#F7F8FA`, surface `#FFFFFF`, hairline `#E8EBF0`, text `#20242C` / `#5B6472` / `#6B7280`. The single accent is the brand purple deepened to `#6D3BB0` — 7.2:1 on white, so it carries AA for normal text and stays consistent with the storefront identity rather than adopting a generic dashboard blue. Semantic pairs (`success`, `warning`, `danger`, `info`) each define text, background and line so a pill, an alert and a stat card communicate the same state the same way.

The audit's suggested `#737B89` secondary text was **not** used for running text: it measures 3.86:1 on white and fails WCAG AA at body sizes. `#6B7280` (4.83:1) is used for metadata and `#5B6472` (5.9:1) for labels; `#737B89` survives only as an icon colour, where 3:1 applies.

**Type.** Fixed scale, no `clamp()` against the viewport: page title 20/600, card title 16/600, body 14, label 13, meta 12. Table headers are 12/700 with letterspacing. All numeric content uses `font-variant-numeric: tabular-nums`, which also retires the storefront display face from data — the reason `0` used to render as a slashed "blocked" glyph (AD-06). The admin UI font is the already-loaded Cairo stack with a system fallback; no new font was added.

**Density.** 4 px rhythm (`--adm-sp-1…8`), control heights 32/36/40, table row ~48, card padding 20, radius 6/8/12/999, three elevation levels (card, popover, dialog). Motion is 120–180 ms ease-out on colour/transform only, with a full `prefers-reduced-motion` opt-out.

**Scoping mechanism.** `body.admin-root` sets `color-scheme: light` and every `--adm-*` token; component rules live in `@layer components` so Tailwind utilities can still override them. Shared components that the storefront also uses (`ConfirmDialog`, `Toaster`) are re-skinned inside the admin subtree only, via `.admin-root [data-testid="toast"]`-style selectors — no storefront visual change, no duplicated toast.

---

## 3. Pages and components

**Created**

| File | Purpose |
| --- | --- |
| `src/app/admin/admin.css` | token layer + all `adm-*` component rules |
| `src/components/admin/dialogs.tsx` | `AdminDialog` (focus trap, Escape, scroll lock, focus restore via the existing `useDialog`) and `AdminConfirm` |
| `docs/audits/admin-panel-ux-ui-audit.md` | Phase 1 audit |
| `artifacts/admin-qa/admin-qa.mts` | reproducible QA harness (gitignored) |

**Rewritten** — `AdminApp.tsx` (shell), `ui.tsx` (kit), `AdminAuth.tsx` (login / MFA verify / MFA enrol + recovery codes), and all 16 files under `sections/`.

**Unchanged by design** — every route handler under `api/v1/admin/*`, all server services, `lib/api/*`, `hooks/use-dialog`, `hooks/use-me`, `ConfirmDialog`, `States`, `Toaster`, the storefront.

New kit pieces: `Button`, `StatusPill`, `EmptyState`, `Toolbar`, `SearchField`, `TextArea`, `Pager`, `useUrlListState`, `useLocalFlag`; `Panel`, `AdminTable`, `StatCard`, `PageTitle`, `TextInput`, `SelectInput`, `Toggle`, `LocalizedFields`, `ImagesEditor`, `SaveBar`, `AdminError` were re-implemented with compatible props.

---

## 4. UX improvements, against the audit findings

| Finding | What changed |
| --- | --- |
| AD-01 dialogs keyboard-inert | Both hand-rolled modals replaced by `AdminDialog`; Escape, focus trap, scroll lock and restore now apply. Measured: stock dialog and MFA-reset dialog close on Escape (previously they did not). |
| AD-02 no skip link | `adm-skip` is the first tab stop in admin (measured). |
| AD-03 clearing a number wrote 0 | Settings keeps raw strings; empty is "not filled in", out-of-range is blocked natively and again in JS before any `PUT`. Measured: VAT=99 → no request, no toast. |
| AD-04 silent form loss | Product, Settings and Blog editors show a sticky save bar with an explicit "Unsaved changes" state and register a `beforeunload` guard. |
| AD-05…AD-12 inherited marketing CSS | Fixed type scale, visible input borders, real card surfaces, dashboard buttons, tokenised colours, `color-scheme: light`. Measured: title 20 px at both 1440 and 1920 (was 26/35), input 36 px at both (was 44/56), border `rgb(220,224,232)` (was transparent). |
| AD-06 slashed zero | Data uses the UI font with tabular figures; `0 ₳` now reads as a value. |
| AD-13 flat navigation | 5 labelled groups, icons, active indicator with accent bar, live badges (open orders, low stock), collapsible 64 px rail with tooltips, off-canvas drawer on mobile. Measured: content starts at y=60 at 390 px (was 366). |
| AD-14 no page context | Breadcrumbs in the topbar; page titles gained descriptions; order detail states number, placed date, item count and total in the header. |
| AD-15 filters not addressable | `useUrlListState` mirrors page/status/search into the query string on orders, products, customers, messages, blog, audit. Measured: `/admin/orders?status=pending` restores the filter, and browser Back returns to it. |
| AD-16 dead dashboard KPIs | Queue cards link to the filtered lists they count, including `status=reconciliation`, which the server already supports. A reconciliation banner appears above the fold. |
| AD-17 no product row actions | Edit and View-in-store actions per row; thumbnails; stock and featured rendered as pills; sales column added. |
| AD-18 one row froze the table | Message status changes disable only the affected row (`onMutate` tracks the id). |
| AD-19 mixed audiences | Accounts table labels role and MFA state and the page is titled "Customers & accounts". Not split — that needs a server-side role filter. |
| AD-20 misleading upload queue | Uploads panel now says uploads save immediately; media library is a card grid with copy/delete. |
| AD-22 order decision buried | Status card moved to the top of the right column with full-width, priority-coloured transition buttons; reservation expiry, payment state and timeline are grouped beside it. |
| AD-23/24 loading and empty states | Column-aware skeletons that keep the page header; empty states explain the cause and offer the action (clear filters, create the first record). |
| AD-25 tables unusable on mobile | Column priority (`hideBelow`) keeps the decisive columns; a scroll affordance appears whenever the table overflows (measured at 390 px: 112 px overflow, hint visible). |
| AD-27/28 inconsistent patterns | One modal for short records (taxonomy, coupons, variants, stock, audit payload), one route for long ones (product, blog); one `StatusPill` everywhere. |
| AD-31 audit payload | Change JSON opens in a dialog instead of a `<details>` inside a cell. |
| AD-32 inventory dead end | Low-stock rows now carry an inline Adjust action that opens the same audited dialog. |

**Deliberately not done:** no notifications bell (nothing behind it — the brief says only if already supported); no relative timestamps (they would make server HTML and client render differ for no user gain); no bulk actions, saved views or charts (no endpoint or data behind them).

---

## 5. Files changed

```
created   src/app/admin/admin.css
created   src/components/admin/dialogs.tsx
created   docs/audits/admin-panel-ux-ui-audit.md
created   docs/audits/admin-panel-redesign-report.md
created   artifacts/admin-qa/admin-qa.mts        (gitignored)
modified  src/app/admin/layout.tsx               admin.css import, body.admin-root, hydration fix
modified  src/app/[locale]/layout.tsx            body suppressHydrationWarning (earlier console-error fix)
modified  src/components/admin/AdminApp.tsx      shell, nav, header, user menu, drawer
modified  src/components/admin/AdminAuth.tsx     login / MFA screens
modified  src/components/admin/ui.tsx            kit + URL state + local flag + pager
modified  src/components/admin/sections/*.tsx    all 15 sections + shared.tsx
modified  .gitignore                             + /artifacts/
modified  tsconfig.json                          exclude artifacts from typechecking
```

No dependency was added or removed. No `any` was introduced (`npx tsc --noEmit` runs with `strict` and `noUncheckedIndexedAccess`).

---

## 6. Verification — what was actually run

All commands were executed on 2026-10-30 against `main` at `911823e` plus these changes.

| Check | Command | Result |
| --- | --- | --- |
| Types | `npx tsc --noEmit` | **pass**, no output |
| Lint | `npx eslint .` | **pass**, no output (after fixing 8 `react-hooks` v6 errors: refs-read-during-render and setState-in-effect) |
| Build | `npm run build` | **✓ Compiled successfully**; route manifest emitted |
| Server tests | `npm run test:server` | **201 passed / 11 files** (unit + integration against an in-memory replica set) |
| E2E | `npx playwright test` | **36 passed, 2 failed, 3 skipped** — see below |
| Admin QA | `artifacts/admin-qa/admin-qa.mts` | **35 checks, 0 failures**; the only logged HTTP error is the deliberate wrong-password `401` asserted by the login check |

**The two Playwright failures are pre-existing and not caused by this work.** They are `navigation.spec.ts:54` (shop dropdown keyboard/focus) and `shop.spec.ts:94` (instant search → results page), both storefront-only. Evidence: `src/app/[locale]/layout.tsx` — the single storefront file I have touched this session — was reverted to its committed state and both specs were re-run; they failed identically. The admin bundle (`admin.css`, `components/admin/*`) is imported only by `src/app/admin/layout.tsx` and is never served on `/en/...` routes.

**Build note.** `npm run build` logs `server data loader failed: PAYMENT_MODE: mock payments are forbidden in production; NEXT_PUBLIC_SITE_URL: production origin must use https`. This comes from `.env` (which carries `PAYMENT_MODE=mock` and an `http://localhost` origin) during static generation, not from these changes: rebuilding with `PAYMENT_MODE=disabled NEXT_PUBLIC_SITE_URL=https://…` produces no such line.

### Measured before → after

| Metric | Before | After |
| --- | --- | --- |
| Page title font-size @1440 / @1920 | 26.25 px / 35.00 px | **20 px / 20 px** |
| Text input height @1440 / @1920 | 44 px / 56 px | **36 px / 36 px** |
| Input border colour | `rgba(0,0,0,0)` | **`rgb(220,224,232)`** |
| `color-scheme` | dark | **light** |
| Card surface vs canvas | `#0c0c0d` on textured black | **`#FFFFFF` on `#F7F8FA` + hairline** |
| Chrome above content @390 | 366 px | **60 px** |
| Sidebar nav spread @1440 | 560 px, 15 flat links | grouped, 754 px incl. footer links, rail collapses to **64 px** |
| First keyboard tab stop | a nav link | **skip link** |
| Stock-adjust dialog closes on Escape | **no** | **yes** |
| MFA-reset dialog closes on Escape | **no** | **yes** |
| Mobile drawer closes on Escape | n/a | **yes** |
| Lists with URL-addressable filters | 0 / 6 | **6 / 6** |
| Distinct status renderings | 4 | **1** |
| Distinct create/edit patterns | 4 | **2** (modal + route) |
| Console/page errors across 15 sections × 8 widths | 0 | **0** (the only browser console line is the deliberate wrong-password `401`) |
| Page horizontal overflow 320–1920 | 0 | **0** |

QA coverage: login error state → MFA → shell; all 15 sections; order deep link + Back + transition confirm; product editor, stock dialog, variant dialog, destructive confirm; new-product dirty state; taxonomy and coupon modals; message filter + expand; audit payload dialog; settings numeric guard; 8 breakpoints × 4 pages; mobile drawer; keyboard entry order.

### Screenshots

`artifacts/admin-qa/shots/` — 68 PNGs (gitignored, regenerable): `00-login`, `01-login-error`, `10-<section>` × 15, `11-nav-collapsed`, `12-user-menu`, `13-orders-filtered`, `14-order-detail`, `15-transition-confirm`, `20`–`26` product flows, `30`–`34` modals, `40`–`41` settings, `50-<width>-<page>` responsive matrix, `60`–`62` mobile.

Regenerate with:

```bash
PORT=3100 NEXT_DIST_DIR=.next-e2e MONGODB_DB_NAME=vapehub_qa PAYMENT_MODE=mock \
RATE_LIMIT_DISABLED=true JOBS_IN_PROCESS=false E2E_TEST_API_TOKEN=e2e-local-token \
npx tsx scripts/dev-memory.ts   # then, in another shell:
BASE_URL=http://localhost:3100 npx tsx artifacts/admin-qa/admin-qa.mts
```

The Phase 1 baseline screenshots are no longer on disk: they lived in `test-results/`, which Playwright deletes at the start of every run. The baseline numbers above were captured before that happened and are recorded in §7 of the audit.

---

## 7. Remaining issues

1. **`GET /admin/blog/{id}` does not exist** (AD-21). The blog editor still resolves a post by scanning the first 100 list rows; beyond that it now shows an explanatory empty state with a way back instead of "Post not found." A real fix needs a new endpoint, which is backend work outside this brief.
2. **In-app navigation can still discard edits.** The dirty state and `beforeunload` guard cover reload and tab close; clicking a sidebar link while a form is dirty does not prompt, because intercepting Next router navigation would mean changing routing behaviour the brief protects. The sticky "Unsaved changes" bar is the current mitigation.
3. **Customers and staff share one table** (AD-19). Splitting needs a role filter on `/admin/users`.
4. **No saved views, sorting or bulk actions** on any list — none of the admin endpoints accept sort or multi-id parameters.
5. **Two confirm dialogs coexist** (`ConfirmDialog` for the storefront, `AdminConfirm` for admin). Deliberate: they belong to different design systems, and both share the same `useDialog` accessibility logic, so behaviour cannot drift.
6. **`docs/design-notes.md` is referenced by `globals.css:5` but does not exist** (AD-38), and `playwright.config.ts:60` targets `responsive.spec.ts` / `checkout.spec.ts`, which are not in `e2e/` (AD-39) — the mobile project matches no files. Both pre-existing, both out of admin scope.
7. **Two storefront E2E specs fail on `main`** (see §6) — unrelated to this work, but they mean `npm run e2e` is not currently green.
8. **Environment:** the machine's `C:` drive was at 100 % during this work, which broke in-memory MongoDB startup (~1 GB of orphaned `%TEMP%\mongo-mem-*` directories from killed dev servers were removed to unblock it). Disk is still near full.
9. **Row actions collapse to icons below ~430 px.** The accessible name ("Edit", "Delete") is still in the DOM and the icons are conventional, but the text label is clipped by the right-aligned cell. Worth a dedicated compact action menu if admins work on phones.

---

## 8. What was preserved (checked, not assumed)

- **Auth & MFA:** login → TOTP verify → shell exercised end to end in the QA run; wrong-password error path asserted.
- **Role gating:** `src/app/admin/layout.tsx` still 404s signed-in non-admins; `AdminApp` still renders the login card for non-admin roles.
- **Routing:** `/admin/[[...path]]` and its 15-entry allow-list are unchanged; no URL was renamed. Query parameters were *added*, which the catch-all segment ignores.
- **Data integrity:** every mutation still goes to the same endpoint with the same body shape; `Idempotency-Key` on checkout, `confirm: true` on transitions, step-up code on MFA reset and reason-on-adjust for stock are all intact. No mock or fixture data was added to the app — fixtures exist only in the throwaway QA database.
- **Test contracts:** all `data-testid` values the redesign kept (`admin-login`, `mfa-code`, `admin-dashboard`, `admin-products`, `admin-orders`, `product-form`, `variant-form`, `stock-adjust-form`, `apply-stock`, `save-*`, `admin-empty`, `admin-error`, `confirm-dialog`, `confirm-action`, `admin-logout`) plus new ones for the added affordances.
