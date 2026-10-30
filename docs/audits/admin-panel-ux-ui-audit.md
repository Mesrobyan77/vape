# Admin Panel — UX/UI Audit (pre-redesign baseline)

Date: 2026-10-30 · Auditor: Qoder agent · Status: baseline for the redesign
Subject: `/admin` section of the Vape Hub Next.js app (commit `911823e`, branch `main`)

---

## 1. Method and evidence base

This audit is grounded in two things: the actual source, and the actually rendered UI.

**Code inspected (complete, not sampled):**

| Area | Files | Lines |
| --- | --- | --- |
| Route + layout | `src/app/admin/[[...path]]/page.tsx`, `src/app/admin/layout.tsx` | 83 |
| Shell, router, auth | `src/components/admin/AdminApp.tsx`, `AdminAuth.tsx` | 368 |
| Shared UI kit | `src/components/admin/ui.tsx`, `sections/shared.tsx` | 448 |
| Sections (15) | `src/components/admin/sections/*.tsx` | 1,834 |
| Global stylesheet (tokens + every class admin uses) | `src/app/globals.css` | 2,182 |
| **Admin panel total** | | **2,733** |

**Rendered UI inspected.** The app was run in its isolated harness (`scripts/dev-memory.ts`, in-memory MongoDB replica set, port 3100, `PAYMENT_MODE=mock`, test-support API enabled). A real admin session was established through the actual UI (password + TOTP), and every section was screenshotted at 1440×900 plus 320/390/430/768/1024 widths. Baseline images: `test-results/shots/baseline/*.png` (38 files).

To make the order-related screens auditable, 11 orders across 5 statuses and 4 contact messages were created **through the public storefront API** (cart → checkout → admin transitions), because the seed catalogue contains no orders. Without them the Orders list, order detail and dashboard queues render empty states only.

**Computed-style measurements** were taken in-page (`getComputedStyle`) at 1440, 1920 and 390 px — quoted below as `measured:`.

**Not audited here:** backend correctness, security posture, API contracts, storefront UI. Where a finding needs a backend change it is marked **needs-backend** and excluded from the redesign scope.

---

## 2. What the admin panel is

- **Architecture.** One Next.js 16 App Router app serves both storefront and admin. `/admin/[[...path]]` is a single dynamic segment validated against a 15-entry allow-list (`page.tsx:4-25`); everything below it is a client-side SPA rendered by `AdminApp` → `SectionRouter` (`AdminApp.tsx:128-163`). There is no per-page server rendering inside admin.
- **Data layer.** TanStack Query over a typed fetch client (`api`/`apiPage`), with two shared hooks (`useAdminList`, `useAdminGet`, `ui.tsx:26-36`). 29 admin route handlers under `/api/v1/admin/*`. CSRF token from login, `Idempotency-Key` on checkout, audit-logged mutations.
- **Auth.** Session cookie + role check in the layout (non-admin → `notFound()`), login → MFA verify → shell; MFA enrolment and recovery-code flows in `AdminAuth.tsx`.
- **Styling.** Tailwind v4 with a custom `@theme` (`globals.css:9-37`), plus ~120 component classes in one `@layer components` block. **Admin has no stylesheet of its own** — it imports the storefront's `globals.css` (`admin/layout.tsx:1`) and reuses storefront marketing classes: `.surface`, `.cus-btn`, `.field`, `.form-group`, `.admin-table`, `.h4`/`.h6`, `.text-link`, `.skeleton`, `.spinner`.
- **Shared components reused from the storefront:** `ConfirmDialog`, `Toaster` (toast), `useDialog`/`useOutsideClick` hooks, `lucide-react` icons, `clsx`.
- **Sections:** Dashboard, Products (list/editor/new + variants + stock), Inventory, Orders (list/detail + state machine), Customers, Categories, Brands, Blog (list/editor), Messages, Coupons, Settings (tax/shipping/store/banners), Uploads, Payments, Audit log, Security.

**What already works and must be preserved:** typed API layer with no `any` in admin code; optimistic-free but correct cache invalidation; `keepPreviousData` list transitions; error states with Retry everywhere; empty states on every table; `aria-invalid`/`aria-describedby` wiring on inputs; `data-testid` coverage for every list, form and action; server-side re-validation of order transitions; step-up (TOTP) requirement for MFA reset; audit logging of stock adjustments.

---

## 3. Findings

Priority: **P0** = blocks correct/safe/equitable use · **P1** = significant friction or visible defect · **P2** = polish.
Class: `UX` workflow · `VIS` visual · `A11Y` accessibility · `RESP` responsive · `CONS` consistency · `STATE` loading/empty/error · `DATA` data-integrity risk in the UI layer.

### 3.1 P0

**AD-01 · `A11Y` Two dialogs are keyboard-inert.**
`StockAdjustDialog` (`Products.tsx:542-565`) and the MFA-reset dialog (`Customers.tsx:106-130`) are hand-rolled overlays: no focus trap, no Escape handler, no initial focus, no focus restore, while `ConfirmDialog` uses the shared `useDialog` hook that does all of it.
Executed evidence: on the same page, *stock-adjust dialog closes on Escape → **false**; confirm dialog → **true**.
Impact: a keyboard user who opens either dialog cannot leave it without finding and activating a button by tabbing through the whole dialog; screen-reader context is not announced (`role="dialog"` without the rest).

**AD-02 · `A11Y` No skip link and no in-page landmarks in admin.**
The storefront layout renders `<a href="#main" class="skip-link">` (`[locale]/layout.tsx:68-70`); the admin tree has no equivalent, and `AdminShell` puts 15 nav links before `<main>` (`AdminApp.tsx:86-123`).
Impact: every keyboard session in admin starts with 15+ tab stops before reaching content.

**AD-03 · `DATA` Clearing a numeric setting silently writes 0.**
`Settings.tsx:57-61` converts every field with `Number(v)` on change; `Number("")` is `0`. VAT rate, both delivery fees, the free-delivery threshold and the reservation TTL all become `0` when the admin selects the text and deletes it — then a single "Save settings" persists it.
Impact: a plausible mis-click changes live storefront pricing/shipping. The same pattern exists in `Coupons.tsx:45-51` (`value`, `minSubtotal`) and `Products.tsx:149` (`num()` there at least maps `""` → `null`).

**AD-04 · `UX` Long forms lose work with no warning.**
Product editor (5 panels, ~30 fields, 3-language triplets), Settings (tax + store + N banners with image editors) and the Blog editor have no dirty-state indication and no leave guard; the save control is at the very end of the page (Settings screenshot: "Save settings" is ~2,000 px below the first field, `10-settings.png`).
Impact: navigating the sidebar mid-edit discards everything silently — the sidebar is always one click away.

### 3.2 P1 — visual system

**AD-05 · `VIS` Admin inherits storefront marketing typography that scales with the viewport.**
`PageTitle` uses `.h4`, panel titles use `.h6`, both defined with `clamp()` against viewport width (`globals.css:170-189`).
measured: page title `26.25px` at 1440 → **`35.0px` at 1920** (+33%); the same control set at 390 renders `20.45px`. The same rule applies to body copy: `body { font-size: clamp(14px, 0.938vw, 21px) }` (`globals.css:78`) → 14 px at 1440 and 18 px at 1920 by that formula.
Impact: identical pages look different on different monitors; titles dwarf content on large displays.

**AD-06 · `VIS` Digits are unreadable in headings — `0` renders as a "blocked" glyph.**
Orbitron's zero is slashed; used for KPI values it is indistinguishable from an error icon.
Rendered evidence: `10-dashboard.png` — "Orders today", "Customers", "Need reconciliation" all read as `⊘`, "Revenue" as `⊘`, while "11" and "6" read normally.
Impact: the dashboard's most important numbers look like failures; `0` vs error is a real ambiguity for a queue-monitoring screen.

**AD-07 · `VIS` Panels are invisible; grouping carries no signal.**
`.surface` is `background: var(--color-black)` (`globals.css:473-475`) on a body whose background is a near-black leather texture. Every container is therefore ~1.0 contrast against its page.
Rendered evidence: `10-settings.png` — the "Promotional banners" panel and the two above it read as different treatments; `10-dashboard.png` — KPI cards are separated only by whitespace.
Impact: users cannot tell where a group ends; the "card" concept does no work.

**AD-08 · `VIS` Inputs have no affordance and change height with the viewport.**
`.form-group input` sets `border: 1px solid transparent` (`globals.css:640`) and `height: clamp(44px, 2.917vw, 72px)`.
measured: input height `44px` at 1440 → **`56px` at 1920**; `border-top-color: rgba(0,0,0,0)` at every width. Meanwhile `ImagesEditor` overrides some controls to `!h-9` (36 px) — three control heights (36/44/56) coexist on one page.
Impact: fields look like inert text until focused; density is unpredictable.

**AD-09 · `VIS` Buttons are marketing buttons.**
`.cus-btn` is a 1 px white outline box with a 0.5 s slide-in fill (`globals.css:491-566`). In admin, the primary action on the order detail page ("Mark delivered") is visually indistinguishable from a secondary one, and on a light surface a white outline would be invisible.
Rendered evidence: `30-order-detail.png` — the only state-changing control on the page is a ghost outline.

**AD-10 · `CONS` Spacing is a mix of rem-scale mistakes and viewport clamps.**
`mb-16` (4 rem) and `mb-24` (6 rem) are used where 16/24 px is clearly intended (`ui.tsx:42`, `ui.tsx:398`, `Products.tsx:56`, `Orders.tsx:30`, `System.tsx:45`, `AdminAuth.tsx:17`).
measured: filter-row bottom margin = **64px** at all widths; panel title → content gap = 64 px.
Impact: ~15–25% of the content column is dead space; related controls (filters and the table they filter) are visually disconnected.

**AD-11 · `VIS` Hardcoded colours bypass the token set.**
`.admin-table` borders `#26272b`, `.skeleton` `#1b1c1f`, `.form-alert.is-*` text `#ffd2d2`/`#d4f7e5`/`#ece3fb`/`#ffedc8`, placeholder `#c9cad1`, `.cus-btn.is-danger::before` `#b4373b` (`globals.css:665,558,696-713,2089,2149`).
Impact: no single place to change the palette; light/dark re-skin is impossible without touching storefront rules.

**AD-12 · `VIS` `color-scheme: dark` is global.**
`:root { color-scheme: dark }` (`globals.css:43`) — measured `dark` at every width. Native pickers (`datetime-local` in Coupons, `<select>` arrows, checkbox/scroll rendering) inherit dark chrome.
Impact: any light admin surface would show dark native controls inside it.

### 3.3 P1 — workflow and information design

**AD-13 · `UX` The sidebar is 15 undifferentiated links.**
`ADMIN_SECTIONS` is a flat list (`AdminApp.tsx:26-42`) with no icons, no grouping, no collapse.
measured: nav links span **560 px** vertically at 1440 (taller than a laptop viewport → the aside scrolls independently, `AdminApp.tsx:87`); at 390 px the links wrap to 4 rows and the whole header block is **366 px** tall, at 320 px **406 px** — 44–48 % of the screen before content starts (`50-390-products.png`).
Impact: the most-used navigation is the least scannable element, and on mobile it pushes the actual work below the fold.

**AD-14 · `UX` No page context anywhere.**
There are no breadcrumbs, no record identity in a header, no "what am I looking at" line. Order detail puts number/status/total/customer inside the page body, so the first screen is a 150 px empty band above the word "Status" (`30-order-detail.png`).

**AD-15 · `UX` List filters, search and pagination are not addressable and reset on every navigation.**
All list state is `useState` (`Products.tsx:37-40`, `Orders.tsx:20-23`, `Customers.tsx:15-17`, `Messages.tsx:13-15`, `System.tsx:36-38`). Opening an order and pressing "Back to orders" returns to page 1, unfiltered.
Impact: the core fulfilment loop (filter → open → act → back) costs repeated re-filtering; no route can be shared with a colleague.

**AD-16 · `UX` Dashboard KPIs are dead ends.**
Eight `StatCard`s with identical weight (`Dashboard.tsx:26-35`); "Pending (COD) orders 6" and "Low-stock variants 4" do not link to the queues they count, and there is no trend, no time scope, and no alert surface for `reconciliationRequired` beyond a ring on one card.

**AD-17 · `UX` Products list has no row actions.**
Columns are Product/Status/Variants/Stock/From/Featured (`Products.tsx:92-107`); to edit, archive, adjust stock or copy a SKU you must open the product first. Featured renders "Yes"/"—", Status renders as a bare word.

**AD-18 · `UX` Messages: one row's action disables every row.**
`disabled={update.isPending}` is applied to each row's `<select>` (`Messages.tsx:69`), so marking one message "read" greys out all 20 status controls until the response lands.

**AD-19 · `UX` "Customers" mixes customers and administrators.**
The section renders `/admin/users` with a Role column and an MFA-reset action for admins (`Customers.tsx:73-93`). Two different jobs (support a buyer vs. recover a colleague's second factor) share one undifferentiated table.

**AD-20 · `UX` Uploads' "New uploads" list is misleading.**
`ImagesEditor` writes to Cloudinary immediately, yet `Uploads.tsx:37-49` presents the results as a pending list that you appear to have to keep; there is no save step, and the panel invalidates the library on every add.

**AD-21 · `DATA` Blog editing depends on the post being in the first 100 list rows.**
There is no `GET /admin/blog/{id}` (only PATCH/DELETE), so `BlogLoader` fetches `pageSize: 100` and searches it (`Blog.tsx:44-50`). Beyond 100 posts, editing an older post fails with a bare `Post not found.` and no way back. **needs-backend** for the proper fix; the UI must at least fail legibly.

**AD-22 · `UX` Order detail buries the decision.**
Transitions are ghost buttons below an optional note field, ~400 px from the status pill; items are not linked to their products; `Payment: cod · pending` on a shipped order is unexplained; the timeline shows raw status tokens with no actor (`Orders.tsx:122-151,153-211`).

**AD-23 · `STATE` Loading states replace the page.**
`ProductLoader` → `<div className="skeleton h-[600px]">` (`Products.tsx:116`), `SettingsSection` → `h-[600px]` (`Settings.tsx:12`), `OrderDetail` → `h-[520px]` (`Orders.tsx:109`). No title, no layout, no partial content; the fixed height is wrong for every real page length. Captured mid-load: `20-product-editor.png` is one grey block.

**AD-24 · `STATE` Empty states are a sentence, not a state.**
`AdminTable` renders `No products match.` in a dashed box (`ui.tsx:88-91`) with no cause, no reset action, and no primary action — e.g. an empty filtered list looks identical to an empty catalogue.

**AD-25 · `RESP` Tables need horizontal scrolling but never say so.**
`min-w-[640px]`/`min-w-[720px]` inside `overflow-x-auto` (`ui.tsx:93-94`, `Products.tsx:467-468`). At 390 px, 3 of 6 columns are visible with no fade, hint, or column priority (`50-390-products.png`); `th { position: sticky; top: 0 }` (`globals.css:2156`) has no effect because the scroll container is the page, not the table wrapper.

**AD-26 · `A11Y` Focus indication is a 1 px border-colour change.**
`.form-group input:focus { outline: none; border-color: var(--color-primary-2) }` (`globals.css:668-673`). On a light surface with a low-saturation accent this is below what WCAG 2.4.11/2.4.7 expects for a keyboard-operable admin.

**AD-27 · `CONS` Three different patterns for the same "create/edit" interaction.**
Taxonomy and Coupons open an inline panel above the table (`Taxonomy.tsx:76-110`, `Coupons.tsx:79-104`); Products and Blog navigate to a route; Variants open an inline form below the table (`Products.tsx:503-523`); stock and MFA reset open hand-rolled overlays; deletions open `ConfirmDialog`.

**AD-28 · `CONS` Status is encoded four different ways.**
`OrderStatusPill` (`shared.tsx:5-18`) for orders; bare words for product/coupon/brand "Active" (`Products.tsx:102`, `Coupons.tsx:117`, `Taxonomy.tsx:120`); `Yes`/`No` coloured spans for payments (`System.tsx:24`); `Enabled`/`Not enrolled` text for MFA (`Customers.tsx:76`). Only one of them has a colour language, and it is not reused.

**AD-29 · `A11Y` Icon-only and ambiguous controls.**
Image remove is a trash icon with `aria-label` but no visible affordance grouping; "← Move" is a text link whose direction is unclear; `ImagesEditor`'s URL/width/height inputs are labelled only by `aria-label` (`ui.tsx:382-384`) so nothing visible explains that width/height are required to add by URL.

**AD-30 · `VIS` Trilingual editing is visually heavy and unbalanced.**
`LocalizedFields` renders a bordered fieldset with three full-width inputs side by side (`ui.tsx:270-291`); on the product editor this stacks five such blocks, and the required language (`hy`) is not distinguished from the optional ones even though validation treats it as the fallback.

### 3.4 P2

- **AD-31** `Audit log` renders change payloads in a `<details>`/`<pre>` inside a table cell (`System.tsx:72-81`) — unreadable, and the filter is action-only.
- **AD-32** `Inventory` duplicates the dashboard's low-stock list with different styling (`Inventory.tsx:17-33`), and stock can only be changed by navigating to the product.
- **AD-33** `Coupons` window column renders `— – —` for unbounded coupons; `datetime-local` has no timezone note although the value is stored as UTC (`Coupons.tsx:25,115`).
- **AD-34** Dates are `en-GB` medium format everywhere (`shared.tsx:20`); no relative time for "3 min ago" style queues.
- **AD-35** Money is right-aligned in some tables, inline in others; no tabular numerals, so columns don't align (`formatAmd` output in `Products.tsx:105`, `Orders.tsx:75`).
- **AD-36** `Payments` and `Security` are single-purpose panels with no page-level structure or explanation of the `configured` vs `enabled` distinction (`System.tsx:22-29`).
- **AD-37** The admin logo is the storefront wordmark asset at 170 px (`AdminApp.tsx:89`), with no "admin" differentiator — easy to mistake for the storefront header while scanning.
- **AD-38** `docs/design-notes.md` is referenced by `globals.css:5` but does not exist; the token set has no written rationale.
- **AD-39** `playwright.config.ts:60` targets `responsive.spec.ts` and `checkout.spec.ts`, which are not in `e2e/` (only `navigation.spec.ts`, `shop.spec.ts`) — the mobile project silently matches nothing. Out of admin scope, recorded because it affects verification planning.
- **AD-40** Magic z-indexes `z-[100001]`/`z-[100002]` in toast and dialog layers (`ui.tsx`/`Products.tsx:543`, `Toaster.tsx`) with no scale.

---

## 4. Repeated inconsistencies (the pattern behind the findings)

1. **One stylesheet, two products.** Marketing and operations share every rule, so admin inherits viewport-scaled type, 0.5 s animations, white-outline buttons and dark native form chrome (AD-05…AD-12).
2. **Spacing intent vs. Tailwind scale.** `mb-16`/`mb-24` used as if they were pixels (AD-10) — 64/96 px gaps in six places.
3. **No component for "status", "empty", "loading", "create/edit".** Each page invents its own (AD-23, AD-24, AD-27, AD-28).
4. **Accessibility is uneven because it is copy-pasted.** The `useDialog` hook centralises the hard part, and two dialogs simply don't use it (AD-01).
5. **Numeric inputs convert through `Number()` on every keystroke** wherever a form was written quickly (AD-03).
6. **Filters are component state, never URL state** (AD-15) — the opposite of how the rest of the app treats routing.

---

## 5. Component disposition

| Component | Today | Decision |
| --- | --- | --- |
| `ui.tsx` `Panel`, `PageTitle`, `StatCard`, `SaveBar` | dark, viewport-scaled type | **Redesign** (light tokens, fixed type scale, KPI as link) |
| `ui.tsx` `AdminTable` | sticky-ineffective, no affordance, weak empty state | **Redesign** + responsive column priority + real empty state |
| `ui.tsx` `TextInput`, `SelectInput`, `Toggle`, `LocalizedFields` | inherits storefront `.field`/`.form-group` | **Redesign** (fixed 36/40 px control heights, visible border, focus ring, required-language cue) |
| `ui.tsx` `ImagesEditor` | 4-col grid wastes space; unclear URL path | **Redesign** (compact tiles, labelled URL row) |
| `ui.tsx` `AdminError`, `adminErrorText`, `fieldError` | good | **Reuse**, restyle only |
| `sections/shared.tsx` `OrderStatusPill` | orders only | **Generalise** into one status primitive used by products/coupons/payments/messages |
| `ConfirmDialog` (shared with storefront) | accessible | **Keep for storefront**; admin gets `AdminConfirm` built on the same `useDialog` hook |
| hand-rolled dialogs in `Products`/`Customers` | not accessible | **Replace** with a new `AdminDialog` primitive (AD-01) |
| `Toaster` (shared) | dark | **Reuse**; re-skin inside the admin scope only |
| `useDialog`, `useOutsideClick` | solid | **Reuse** for sidebar drawer, user menu, dialogs |
| `useAdminList`, `useAdminGet` | solid | **Reuse**; add URL-synced list state on top (AD-15) |
| `AdminApp` shell | flat nav, no header | **Rewrite** shell: grouped sidebar, header with breadcrumbs + record context + user menu |

---

## 6. Recommended design direction

The panel serves a small Armenian e-commerce operation: the daily loop is *triage orders → fix stock → edit catalogue → answer messages*, on a laptop, often in a hurry, in three languages. The design should optimise for **scanning, queue-reading and low-error data entry**, not for presentation.

1. **Own the admin surface.** A dedicated, admin-scoped token layer and component set; the storefront keeps its dark marketing system untouched. `color-scheme: light` inside admin so native controls agree with the surface.
2. **Light, quiet, dense-but-breathable.** `#F7F8FA` canvas, `#FFFFFF` surfaces, `#E8EBF0` hairlines, `#20242C`/`#737B89` text. One accent — the brand purple, deepened for AA contrast on white — used only for the primary action and the active nav item. Semantic green/amber/red/blue reserved for status meaning, never decoration.
3. **Fixed, non-viewport type scale** with tabular numerals for money, stock and counts; a distinct readable face for data (the storefront's display face is what makes `0` unreadable — AD-06).
4. **A real 4 px spacing rhythm** replacing the `mb-16`/`mb-24` mistakes; card padding, row height and control height as tokens.
5. **Navigation by work type**: Operations (Dashboard, Orders, Inventory, Messages), Catalog (Products, Categories, Brands, Uploads), Content & Growth (Blog, Coupons), System (Settings, Payments, Audit, Security) — grouped, iconed, collapsible, off-canvas on mobile.
6. **Header carries context**: breadcrumbs, record identity (order number + status + total, product name + status), and the page's primary action — so the decision is always near the top (AD-14, AD-22).
7. **Queue-first dashboard**: KPI cards link to the pre-filtered list they count; reconciliation and low stock are actionable, not decorative (AD-16).
8. **One status primitive, one empty state, one loading skeleton, one dialog, one editor pattern** (drawer for short records, route for long ones) applied across all 15 sections (AD-23, AD-24, AD-27, AD-28).
9. **Addressable lists**: filters, search and page mirrored into the query string so "back" and "share this view" work (AD-15).
10. **Error prevention over error reporting**: numeric fields keep empty as empty until blur (AD-03), dirty-form guard with a sticky save bar (AD-04), destructive actions always confirmed with the record named.
11. **Keyboard and contrast parity**: visible focus ring on all interactive elements, skip link, landmarks, dialogs with trap/Escape/restore, no colour-only status (AD-01, AD-02, AD-26).

---

## 7. Baseline metrics for before/after comparison

| Metric | Baseline (measured) |
| --- | --- |
| Console/page errors across 15 sections + 5 widths | **0** |
| Page title font-size @1440 / @1920 | 26.25 px / 35.00 px |
| Text input height @1440 / @1920 | 44 px / 56 px |
| Filter-row bottom margin | 64 px |
| Sidebar nav vertical spread @1440 | 560 px (15 flat links) |
| Chrome height before content @390 / @320 | 366 px / 406 px |
| Page horizontal overflow @320–1024 | 0 px |
| Stock-adjust dialog closes on Escape | **no** |
| Confirm dialog closes on Escape | yes |
| Admin sections with URL-addressable filters | 0 / 15 |
| Distinct status-rendering patterns | 4 |
| Distinct create/edit patterns | 4 |

---

## 8. Known limitations of this audit

- Screenshots come from the isolated in-memory environment with mock payments; the real Atlas dataset may expose long-text and high-volume layout cases not seen here (e.g. 100+ product lists, very long trilingual descriptions).
- Order data was synthesised through the public API, so real-world payment/timeline variety (provider references, partial refunds, reconciliation cases) is under-represented.
- No screen-reader or keyboard-walkthrough testing beyond the executed Escape/trap probes above; AD-01/AD-02/AD-26 are code-and-interaction findings, not assistive-technology transcripts.
- No usability testing with real admins; the workflow claims (AD-13…AD-22) are reasoned from the code paths and the rendered screens, not from observation.
