# MASTER IMPLEMENTATION PROMPT — VAPE HUB V3
## Enterprise-Quality, Secure, Fully Tested E-Commerce Platform for Armenia

You are acting as a principal software architect, senior full-stack engineer, senior UI/UX designer, application security engineer, database engineer, QA automation engineer, DevOps engineer, and accessibility specialist.

Your task is to build a complete, polished, production-oriented e-commerce platform for an adult vape and accessories store serving Armenia.

This is NOT a design-only exercise. This is NOT a static prototype. This is NOT a landing page with fake buttons. This is NOT a collection of disconnected mock components.

Build a complete working application with real frontend interactions, a real backend, persistent database storage, authentication, product and inventory management, shopping cart, checkout, orders, payment-provider integrations, admin dashboard, email workflows, security controls, automated tests, browser-based end-to-end tests, deployment documentation, and operational instructions.

The result must be visually excellent, functionally complete, secure by design, responsive, accessible, maintainable, and testable.

Do not claim something works unless you have implemented and verified it. Do not claim tests passed unless you actually ran them and inspected their results.

---

# 1. ABSOLUTE RULES

These requirements override convenience and shortcuts.

## 1.1 Two genuinely separate Git repositories

The frontend and backend MUST be separate Git repositories.

Repository A:

`vape-hub-frontend`

Repository B:

`vape-hub-backend`

They may live next to one another inside a local parent directory named `vape-hub/`, but the parent directory must NOT be a Git repository that combines both applications.

Expected local development layout:

```text
vape-hub/
├── frontend/                 # Git repository A
│   ├── .git/
│   ├── package.json
│   ├── package-lock.json
│   ├── src/
│   ├── tests/
│   ├── e2e/
│   ├── playwright.config.ts
│   ├── .env.example
│   └── README.md
│
└── backend/                  # Git repository B
    ├── .git/
    ├── package.json
    ├── package-lock.json
    ├── src/
    ├── tests/
    ├── .env.example
    └── README.md
```

Use the actual package manager selected for each repository consistently. The example above shows npm lockfiles; do not create conflicting lockfiles for multiple package managers.

Mandatory rules:

- Each application has its own Git history, branches, commits, releases, dependency tree, lockfile, CI workflow, configuration, tests, and README.
- Do not create a root package.json that orchestrates both applications as a workspace.
- Do not use pnpm workspaces, npm workspaces, Turborepo, Nx, Lerna, or a shared JavaScript package that makes the applications a monorepo.
- Do not import backend source files directly into the frontend.
- Do not import frontend source files directly into the backend.
- The frontend communicates with the backend through documented, versioned HTTP APIs.
- Keep API contracts documented in both repositories. If generating OpenAPI clients or shared type definitions, publish or generate them through a documented, versioned contract process—not cross-repository source imports.
- Each repository must be independently installable, testable, buildable, and deployable.
- Configure CI independently for both repositories.
- Explain how the repositories communicate during local development, testing, staging, and production.
- Never place secrets in Git history, frontend environment variables exposed to the browser, test fixtures committed with real credentials, or documentation.

If the current working directory does not allow creation of two independent repositories, create the two application directories, initialize Git independently in each, and document exactly what has and has not been initialized. Never silently fall back to a monorepo.

## 1.2 Work directly in files

Inspect the existing environment and repositories before modifying anything.

If useful existing code exists, preserve it where appropriate. If code is broken, repair it. Do not overwrite useful work without understanding it.

Do not stop after producing a plan. Implement the project.

Do not deliver only code snippets in chat. Create the actual project files.

Do not leave the application in a permanently incomplete state because the task is large. Implement in milestones, but continue through the entire scope wherever the environment permits.

Do not use fake data as a substitute for real application behavior.

Development fixtures are allowed only through an explicit development-only seed command. Production must never automatically seed demo products, fake customers, sample orders, or default administrator accounts.

## 1.3 Never fake integration success

If a payment gateway, email provider, Cloudinary account, Pexels API, or production database cannot be configured because credentials are unavailable:

1. Implement the correct adapter and configuration interface.
2. Add safe development-only mocks where appropriate.
3. Write tests for the integration contract.
4. Document the missing credentials and exact setup procedure.
5. Clearly distinguish simulated behavior from real provider verification.
6. Do not enable unverified live payments.
7. Do not claim that real payment processing was verified without performing an actual authorized integration test.

---

# 2. PROJECT REFERENCES

Primary visual reference:

https://uiparadox.co.uk/templates/vape-hub/v3/index.html

Pexels API documentation:

https://www.pexels.com/api/documentation/

Pexels API overview:

https://www.pexels.com/api/

Use the reference as the main visual direction for the storefront. Inspect the actual reference pages and interactions before designing the equivalent pages.

Do not blindly copy every implementation detail from the template. Recreate the visual language and user experience with maintainable, accessible, production-quality components.

If a reference page cannot be accessed, record that limitation and make a reasonable design decision consistent with the rest of the site.

Create these documentation files:

- `docs/design-notes.md` in the frontend repository.
- `docs/assets.md` in the frontend repository.
- `docs/api-contract.md` in the frontend repository.
- `docs/architecture.md` in the backend repository.
- `docs/data-model.md` in the backend repository.
- `docs/security.md` in the backend repository.
- `docs/payment-integrations.md` in the backend repository.
- `docs/deployment.md` in the relevant repository or both, where appropriate.
- `DECISIONS.md` in each repository.
- `PROGRESS.md` in each repository.

Document important decisions instead of silently inventing inconsistent behavior.

---

# 3. BUSINESS REQUIREMENTS

Build an online shop for adult customers in Armenia.

The store sells permitted adult-oriented vaping products, e-liquids, devices, pods, and accessories, subject to applicable laws and platform/provider rules.

The design should feel like a premium specialist brand, not a generic marketplace.

Core business principles:

- Clear product information.
- Transparent prices and delivery fees.
- Reliable inventory.
- No overselling.
- Safe checkout.
- Honest payment status.
- Clear order tracking.
- Fast and intuitive browsing.
- Strong mobile experience.
- Professional customer communications.
- A secure and practical administration system.

Do not make unsupported medical or health claims. Include legally appropriate age verification, warnings, and required disclosures. Do not assume that an age confirmation checkbox alone satisfies every legal obligation. Document the need to review Armenian legal requirements before production launch.

Do not build functionality intended to bypass applicable age restrictions or payment-provider rules.

---

# 4. TECHNOLOGY STACK

Use compatible, stable releases available at implementation time. Pin dependencies through each repository's lockfile.

## 4.1 Frontend repository

Use:

- Next.js App Router.
- React.
- TypeScript with strict mode.
- Tailwind CSS.
- Framer Motion for purposeful animation.
- Lucide React for icons.
- React Hook Form.
- Zod for client-side validation.
- TanStack Query where client-side server state is appropriate.
- `next-intl` or an equivalent well-supported localization solution.
- Playwright for browser-based end-to-end testing.
- Vitest for unit tests.
- React Testing Library for component tests.
- axe-core integration for automated accessibility testing.

Prefer Server Components for static and server-rendered content. Use Client Components only where interaction requires them.

Do not make every page a Client Component without a reason.

## 4.2 Backend repository

Use:

- Node.js LTS.
- TypeScript strict mode.
- Express.
- MongoDB.
- Mongoose.
- Zod or equivalent strict request validation.
- Server-side session management stored in MongoDB.
- Argon2id password hashing.
- Helmet or equivalent HTTP security headers.
- Pino or another structured logger with redaction.
- Vitest.
- Supertest.
- `mongodb-memory-server` in replica-set mode for integration tests that require transactions.
- Dedicated security and concurrency test suites.

Use a versioned REST API under `/api/v1`.

Separate the backend into clear layers:

`route → authentication/authorization → validation → controller → service → repository/model`

Controllers must not contain complex business rules or directly perform uncontrolled database operations.

The service layer owns pricing, inventory, reservations, checkout, payments, and order-state transitions.

## 4.3 Infrastructure and integrations

Use:

- MongoDB Atlas or a properly configured MongoDB replica set.
- Cloudinary for managed product media.
- Nodemailer or equivalent SMTP integration for email.
- Pexels API for optional photography discovery and suitable licensed visual assets.
- GitHub Actions for CI.
- Docker where appropriate for local backend infrastructure.
- OpenAPI for API documentation.
- A managed secret store in production.

Do not introduce unnecessary infrastructure just to make the project appear more complex.

---

# 5. VISUAL DESIGN SYSTEM

First analyze the reference. Document:

- Color palette.
- Primary and secondary accent colors.
- Background and surface colors.
- Text and muted text colors.
- Border colors.
- Typography and font scale.
- Heading sizes and line heights.
- Spacing scale.
- Container widths.
- Border radii.
- Shadows.
- Button sizes and variants.
- Input styles.
- Product-card layout.
- Product image aspect ratios.
- Hero layout.
- Navbar dimensions.
- Dropdown appearance.
- Section spacing.
- Breakpoints.
- Mobile navigation.
- Hover effects.
- Loading and transition behavior.
- Footer structure.

Implement the design tokens using CSS variables and Tailwind theme configuration.

Create reusable components instead of styling every page independently.

The site must feel consistent across every route.

Avoid:

- Generic dashboard-looking storefront pages.
- Excessive gradients.
- Random color changes.
- Arbitrary font sizes.
- Inconsistent spacing.
- Emoji used as interface icons.
- Overly large rounded cards everywhere.
- Unnecessary animation.
- Text that is too small on mobile.
- Buttons without visible interaction states.
- Placeholder rectangles left in production pages.

Every component must have default, hover, focus, active, disabled, loading, and error states wherever relevant.

---

# 6. NAVBAR AND GLOBAL NAVIGATION

Create a polished responsive navbar.

Desktop layout:

**Left:**
- Brand logo.
- Logo links to the localized homepage.

**Center:**
- Home.
- Shop dropdown.
- About Us.

Shop dropdown includes:

- Shop Grid.
- Shop Grid (Sidebar).

**Right:**
- Search icon.
- Language switcher.
- Account icon.
- Cart icon with a live quantity badge.

Requirements:

- Sticky navbar.
- Smooth background and shadow transition when scrolling.
- Dropdown works with mouse, keyboard, and touch.
- Dropdown closes correctly on outside click, Escape, and route navigation.
- Accessible focus management.
- Visible focus states.
- Mobile hamburger menu.
- Mobile slide-in navigation.
- Account and cart remain accessible on mobile.
- Search opens a working overlay or expandable search field.
- Cart badge reflects actual cart state.
- No dead navigation links.
- Every visible navigation item leads to a real page or a valid interaction.

Create breadcrumb navigation for catalog, product, account, and checkout pages where appropriate.

Test all navigation states in Playwright.

---

# 7. CUSTOM CURSOR TRAIL

Create a subtle, premium cursor trail as an original addition to the reference.

Requirements:

- Use a lightweight canvas or a small, controlled set of elements.
- Use `requestAnimationFrame` when animation is active.
- Avoid triggering React renders on every pointer movement.
- Keep the trail behind interactive elements.
- Use `pointer-events: none`.
- Never block clicks, scrolling, text selection, or drag interactions.
- Use a small number of particles.
- Fade particles naturally.
- Use the brand accent color.
- Avoid expensive blur filters and excessive GPU usage.
- Pause when the document is hidden.
- Disable on touch devices.
- Disable when `prefers-reduced-motion: reduce` is active.
- Clean up event listeners and animation frames on unmount.
- Ensure no memory leaks.
- Ensure the trail never prevents a user from completing checkout.

Test that the effect is enabled only on supported devices, respects reduced-motion settings, and does not interfere with navigation or pointer interactions.

---

# 8. RESPONSIVE LAYOUT

Test at a minimum:

- 320px mobile.
- 360px mobile.
- 390px mobile.
- 430px mobile.
- 768px tablet.
- 1024px laptop.
- 1280px desktop.
- 1440px desktop.
- 1920px wide desktop.

At every breakpoint verify:

- No horizontal overflow.
- No clipped text.
- No overlapping buttons.
- No inaccessible menus.
- No broken product grids.
- No inaccessible checkout controls.
- No hidden cart controls.
- No modal larger than the viewport.
- No sticky element covering important content.
- No product image distortion.
- No inaccessible keyboard focus.

Use mobile-first CSS and responsive image sizes.

Test portrait and landscape layouts where relevant.

---

# 9. LOCALIZATION AND ARMENIAN MARKET

Supported storefront languages:

- Armenian: `hy`, default.
- Russian: `ru`.
- English: `en`.

Use locale-prefixed routes:

- `/hy/...`
- `/ru/...`
- `/en/...`

Requirements:

- Armenian is the default locale.
- Language switching preserves the current page where a translation exists.
- Fall back to Armenian when translated product content is unavailable.
- Never display raw translation keys.
- Translate navigation, buttons, validation messages, empty states, loading states, checkout, emails, legal pages, metadata, product information, and errors.
- Store localized product and category content in MongoDB.
- Localize order-related email templates.
- Persist the customer's language preference where appropriate.
- Include localized SEO metadata and `hreflang`.
- Format currency consistently.

Use AMD only for storefront prices.

Example:

`12 500 ֏`

Do not display decimals for AMD.

Use a shared currency formatting utility with automated tests.

Do not rely on browser locale defaults to format all prices consistently.

Test every supported locale on all major page types using Playwright.

---

# 10. AGE GATE AND RESPONSIBLE DISPLAY

Because this shop concerns adult-oriented products:

- Implement an initial 18+ confirmation gate.
- Remember the confirmation using a suitable cookie or server-supported mechanism.
- Add a clear 18+ confirmation in checkout.
- Display required product and footer warnings.
- Avoid misleading medical claims.
- Do not design the experience to appeal specifically to minors.
- Do not allow the user to bypass mandatory restrictions through client-side manipulation alone.
- Enforce applicable age and eligibility requirements on the server where legally required.
- Document legal-review requirements for Armenia.

The age gate must have:

- Loading state if any verification is asynchronous.
- Clear confirm and exit actions.
- Keyboard accessibility.
- Mobile support.
- Correct behavior on reload and route navigation.
- Automated tests for confirmation, rejection, and stored state.

Do not treat a browser-only boolean as sufficient proof of legal identity or age verification where stronger verification is required.

---

# 11. HOME PAGE

Implement the homepage in a sequence informed by the reference.

Include:

1. Hero section with strong visual impact.
2. Hero headline and supporting text.
3. Primary Shop CTA.
4. Secondary CTA if suitable.
5. Category strip.
6. Featured products.
7. New arrivals.
8. Best sellers.
9. Promotional banners.
10. Brand strip.
11. Store benefits.
12. Delivery and support information.
13. Blog preview.
14. Contact or newsletter section where appropriate.
15. Complete footer.

Requirements:

- Product data comes from the backend.
- Featured products are managed through the admin panel.
- Promotional banners are configurable.
- No fake products are silently shown in production.
- If the catalog is empty, show a designed empty state.
- Images have correct aspect ratios and responsive sizes.
- The hero remains usable while images load.
- CTA buttons work.
- Every section is responsive.
- Use server rendering for SEO-critical content where practical.
- Add loading skeletons when content is fetched asynchronously.
- Handle backend errors gracefully.

Test homepage loading, empty catalog, product rendering, CTA navigation, and mobile layout.

---

# 12. SHOP GRID AND SIDEBAR CATALOG

Create two real catalog pages:

- Shop Grid.
- Shop Grid (Sidebar).

Both must use the same backend catalog and filtering rules.

Features:

- Responsive product grid.
- One to four columns depending on viewport.
- Product count.
- Pagination.
- Sorting.
- Newest first.
- Price ascending.
- Price descending.
- Popularity.
- Category filters.
- Brand filters.
- Flavor filters.
- Nicotine-strength filters.
- Price-range filters.
- In-stock filter.
- Active filter chips.
- Clear-all filters.
- Mobile filter drawer.
- Empty search/filter state.
- Loading skeletons.
- Error and retry states.

Filters must be reflected in URL query parameters.

Examples:

`/hy/shop?category=pods&sort=price-asc`

Ensure malformed query parameters do not crash the page.

Validate pagination, sort values, and filter ranges on the backend.

Do not trust client-supplied price or stock information.

Test all filter combinations and URL persistence.

---

# 13. PRODUCT DETAIL PAGE

Each product page must include:

- Breadcrumbs.
- Product gallery.
- Main image.
- Thumbnail selector.
- Image zoom or accessible enlarged view.
- Product name.
- Brand.
- SKU for the selected variant.
- Price.
- Sale price where applicable.
- Previous price when appropriate.
- Discount badge only when the discount is real.
- Short description.
- Full description.
- Category.
- Tags where appropriate.
- Variant selectors.
- Stock status.
- Quantity selector.
- Add-to-cart button.
- Product warnings.
- Related products.
- Delivery information.
- SEO metadata.
- Product structured data when accurate.

Variants may include:

- Flavor.
- Nicotine strength.
- Volume.
- Device compatibility.
- Other relevant attributes.

Each variant has its own SKU, price, optional sale price, stock, and optional images.

When a user selects a variant, update the visible price, SKU, stock, availability, and image gallery as necessary.

Unavailable variants must be disabled and labelled clearly.

Quantity cannot exceed the verified available stock.

Do not use stale frontend stock values as the final authority.

The backend must validate every add-to-cart and order operation.

The Add to Cart button must have:

- Idle state.
- Loading state.
- Success feedback.
- Out-of-stock state.
- Disabled state.
- Error state.
- Duplicate-click protection.

Test variant switching, stock limits, image selection, price display, and add-to-cart behavior.

---

# 14. SEARCH

Create both an instant search overlay and a full search results page.

Instant search:

- Debounced requests.
- Search suggestions.
- Product thumbnail.
- Product name.
- Price.
- Keyboard navigation.
- Enter to open results.
- Escape to close.
- Clear search.
- Loading indicator.
- No-results state.
- Error and retry state.

Full search:

- Search query in the URL.
- Pagination.
- Sorting.
- Catalog filters.
- Empty results state.
- Correct loading and error behavior.

Protect the backend against excessively expensive search queries and abusive request patterns.

Test debouncing, keyboard navigation, query encoding, empty queries, malformed input, and backend errors.

---

# 15. CART

Implement:

1. Cart drawer.
2. Full cart page.
3. Guest cart.
4. Authenticated customer cart.
5. Guest cart merge on login.

Cart line items display:

- Product image.
- Product name.
- Selected variant.
- Unit price.
- Quantity.
- Line total.
- Remove button.
- Stock or availability status.

Cart summary displays:

- Subtotal.
- VAT portion.
- Estimated shipping.
- Total.
- Any applicable, valid discount.
- Delivery threshold progress where appropriate.

Requirements:

- Quantity increment/decrement.
- Remove item.
- Clear cart if supported.
- Validate availability when loading the cart.
- Handle products that became inactive.
- Handle stock reductions.
- Handle price changes.
- Handle deleted variants.
- Show clear explanations and recovery actions.
- Preserve cart state appropriately.
- Merge guest cart without duplicate or invalid items.
- Do not trust client-side totals.
- Prevent repeated submissions.

If the cart cannot load, display a clear error with a retry action rather than showing a misleading empty cart.

Test cart behavior across reloads, login, logout, sessions, product changes, and multiple tabs.

---

# 16. PRICING, VAT AND SHIPPING

Currency: AMD.

Prices include VAT.

VAT rate: 20%, configurable by an authorized administrator.

Display the VAT portion in the order summary.

When prices include VAT, calculate the VAT portion from the VAT-inclusive amount using the appropriate formula and a documented rounding policy. Do not simply add 20% to an already VAT-inclusive price.

For a VAT-inclusive total:

`VAT portion = VAT-inclusive amount × 20 / 120`

Apply a consistent rounding policy in AMD.

Shipping defaults:

- Yerevan: 1,000 ֏.
- Other regions: 2,000 ֏.
- Free shipping for eligible orders above 20,000 ֏.

The threshold and delivery fees must be configurable in admin settings.

Document whether the free-shipping threshold applies before or after discounts. Choose one consistent rule and enforce it server-side.

The backend calculates:

- Item prices.
- Variant prices.
- Sale prices.
- Discounts.
- VAT portion.
- Shipping.
- Final total.

The client sends product/variant identifiers and requested quantities—not authoritative prices or totals.

Never trust a client-supplied subtotal, discount, VAT, shipping charge, or order total.

Write unit tests for all pricing rules, boundaries, rounding, and shipping thresholds.

---

# 17. AUTHENTICATION AND SESSIONS

Implement:

- Register.
- Login.
- Logout.
- Current user endpoint.
- Forgot password.
- Reset password.
- Profile management.
- Change password.
- Session revocation.

Requirements:

- Normalize email addresses.
- Prevent duplicate accounts.
- Hash passwords with Argon2id.
- Use generic login failure messages.
- Apply rate limits to authentication endpoints.
- Validate all input on the server.
- Use time-limited, single-use password reset tokens.
- Store only hashed reset tokens.
- Never log reset tokens.
- Invalidate existing sessions after password reset or appropriate security-sensitive changes.
- Rotate the session identifier after authentication and privilege changes.
- Support immediate session revocation.
- Avoid account enumeration.
- Protect against brute-force attempts.

Use server-side sessions stored in MongoDB.

The browser receives only an opaque session ID in an HttpOnly cookie.

Cookie requirements:

- HttpOnly.
- SameSite=Lax or stricter where compatible.
- Secure in production.
- Appropriate path and domain settings.
- Reasonable session expiration.
- Idle and absolute timeouts.
- No session ID in URLs.
- No session tokens in localStorage.
- No JWT-only localStorage authentication.

Implement CSRF protection using an appropriate double-submit token pattern plus Origin/Referer validation for state-changing requests. Use a robust token design and test it; do not assume that merely checking a header is sufficient.

Ensure session storage and cookie configuration are compatible with the separate frontend and backend deployment domains.

Test session fixation, logout, expiration, session rotation, reset-token reuse, and revoked sessions.

---

# 18. CUSTOMER ACCOUNT

Implement:

- Account overview.
- Profile details.
- Change password.
- Saved addresses.
- Default address.
- Order history.
- Order details.
- Order status timeline.
- Language preference.
- Logout.

Authorization must be enforced on the backend.

A customer can access only their own profile, addresses, cart, and orders.

Never trust a user ID supplied by the browser to determine which private records can be accessed.

Every private database query must be scoped by the authenticated user or an explicitly authorized administrative role.

Test cross-account access attempts and authorization boundaries.

---

# 19. ORDER MANAGEMENT

Each order must have a unique human-readable order number and an internal immutable identifier.

Store a snapshot of:

- Product name at purchase time.
- Product SKU.
- Variant attributes.
- Quantity.
- Unit price.
- Line total.
- Discount information.
- VAT information.
- Shipping address.
- Shipping cost.
- Customer details needed to fulfill the order.
- Payment method.
- Currency.
- Order locale.
- Price calculation metadata.

An order must not change historical line-item pricing merely because the current catalog price changes.

Use an explicit state machine.

Possible states:

- `pending`
- `awaiting_payment`
- `paid`
- `processing`
- `shipped`
- `delivered`
- `cancelled`
- `refunded`
- `payment_failed`
- `expired`

Define permitted transitions centrally.

Reject invalid transitions.

Every administrative status change must be authorized, validated, and audit-logged.

Do not allow an order to transition from cancelled to paid simply because a delayed callback arrives.

Do not allow an order to be refunded twice.

Do not allow an unpaid order to be marked shipped without an explicitly defined authorized business rule.

Use transactional outbox patterns or an equivalent reliable approach for critical asynchronous side effects such as order emails and payment-related notifications.

Test valid transitions, invalid transitions, duplicate events, delayed callbacks, and competing status updates.

---

# 20. CRITICAL INVENTORY CONCURRENCY: NEVER OVERSELL

This section is mandatory and must receive special attention.

Scenario:

A product variant has exactly one unit left in stock.

Two different customers open separate browsers, maintain independent sessions, and try to purchase the final unit at almost the same time.

Exactly one purchase may reserve or consume the last unit.

The other must receive a clear out-of-stock or reservation-conflict response.

It must never be possible for both customers to successfully reserve the same last unit.

## 20.1 Required implementation

Use MongoDB transactions with a replica set for multi-document operations.

Use atomic conditional inventory updates.

An inventory decrement must include the stock condition in the database update itself.

Conceptually:

```text
UPDATE variant
WHERE variantSku = requestedSku
AND stock >= requestedQuantity
SET stock = stock - requestedQuantity
```

Implement the equivalent using MongoDB's atomic conditional update semantics.

Check the matched/modified result.

If the stock condition fails, do not create a successful reservation or order.

Never implement inventory as:

1. Read stock.
2. Check stock in application memory.
3. Decrement later without an atomic condition.

That pattern is vulnerable to race conditions.

Do not depend on disabling the checkout button to prevent overselling.

Frontend controls improve usability but do not provide inventory correctness.

## 20.2 Reservation model

Design an explicit inventory reservation model.

Reservations should include:

- Reservation ID.
- Order ID or checkout identifier.
- Product variant identifier.
- SKU.
- Quantity.
- Reservation status.
- Creation time.
- Expiration time.
- Release time.
- Consumption time.
- Idempotency key.

Define reservation states such as:

- `active`
- `consumed`
- `released`
- `expired`

Use conditional state transitions so a reservation cannot be released or consumed twice.

A reservation release must restore stock at most once.

An order cancellation must not restore inventory twice.

A delayed payment callback must not consume stock that has already been released and sold to another customer.

## 20.3 Reservation expiration

Implement a background worker or scheduled job to release expired reservations.

Do not rely solely on MongoDB TTL deletion to restore stock.

TTL cleanup can delete expired documents, but deletion alone does not perform the required business transaction.

Expiration logic must:

1. Find eligible expired active reservations.
2. Atomically claim or transition each reservation.
3. Restore inventory exactly once.
4. Update the associated order/payment state consistently.
5. Commit all related changes transactionally where possible.
6. Retry safely after transient errors.
7. Be idempotent across worker restarts and multiple workers.

Use a lease, atomic claim, or another safe coordination mechanism if multiple workers can process reservations concurrently.

## 20.4 Transaction retry behavior

MongoDB transactions can experience transient errors and write conflicts.

Implement bounded retry logic for retryable transaction failures.

Do not retry a non-idempotent external payment request blindly.

Use an idempotency key and durable transaction state.

Avoid sending email, charging a payment provider, or performing other irreversible external actions inside a transaction callback that may be retried.

Use an outbox or post-commit orchestration where appropriate.

## 20.5 Mandatory concurrency tests

Create dedicated automated concurrency tests.

### Test A: final unit

Initial stock: 1.

Two independent users issue synchronized concurrent requests to purchase quantity 1.

Expected:

- Exactly one successful reservation.
- Exactly one rejected reservation.
- Final stock equals 0.
- Stock never becomes negative.
- No duplicate active reservations.
- No duplicate order line for the same reservation due to retries.
- No partial order that falsely appears successful.

### Test B: limited multi-unit stock

Initial stock: 5.

Several independent users concurrently request quantities whose sum exceeds 5.

Expected:

- Total successfully reserved quantity never exceeds 5.
- Stock never becomes negative.
- Rejected requests do not leave partial reservations.
- Database invariants remain valid.

### Test C: duplicate idempotent request

Send the same order-creation request twice with the same idempotency key.

Expected:

- No duplicate order.
- No duplicate stock decrement.
- The client receives a consistent response referring to the original operation.

### Test D: reservation expiration

Create an active reservation, expire it, and run the expiration worker repeatedly.

Expected:

- Stock is restored exactly once.
- Reservation is released or expired exactly once.
- Repeated worker execution does not increase stock repeatedly.

### Test E: cancellation race

Race cancellation against reservation consumption or payment confirmation.

Expected:

- One valid terminal outcome.
- No double restoration.
- No duplicate payment transition.
- No inventory inconsistency.

### Test F: payment callback race

Send duplicate and concurrent callbacks for the same payment.

Expected:

- Only one valid state transition.
- No duplicate inventory consumption.
- No duplicate order fulfillment.
- No repeated side effects.

### Test G: multi-variant cart

A cart contains multiple variants. One variant becomes unavailable during checkout.

Expected:

- The checkout fails safely or applies an explicitly documented partial policy.
- No inconsistent partial stock decrement remains.
- No order falsely claims that all requested items were reserved.

### Test H: process interruption

Simulate failure during reservation processing and recovery.

Expected:

- Durable state allows recovery.
- Retried operations remain idempotent.
- No overselling.
- No unexplained stock drift.

Run these tests against a real MongoDB replica-set test environment, not only mocked model methods.

Record the results in the test report.

---

# 21. CHECKOUT

Implement a complete checkout flow.

Fields:

- Customer name.
- Email.
- Phone.
- Shipping region.
- City or locality.
- Address.
- Additional delivery instructions if required.
- Payment method.
- Required adult confirmation.
- Required terms acceptance.

Checkout must:

1. Validate the cart on the server.
2. Verify that products and variants remain active.
3. Recompute all prices.
4. Recompute discounts.
5. Recompute VAT.
6. Recompute shipping.
7. Validate the selected delivery region.
8. Reserve inventory atomically.
9. Create the order transactionally.
10. Create a durable payment transaction record where applicable.
11. Return an appropriate order/payment state.
12. Trigger external side effects safely after durable state changes.

Use an idempotency key for order creation.

The client must prevent accidental double-clicks, but backend idempotency is mandatory even if the UI disables the button.

When stock changes during checkout, show a useful error and update the cart.

Do not expose private order information in success-page URLs.

Create a success page with a safe order reference and a real server-side status check.

For pending payments, show an honest pending state instead of assuming success.

---

# 22. PAYMENT ARCHITECTURE

Support:

1. Cash on delivery.
2. Idram.
3. ArCa card payment through an approved, configured gateway adapter.

Use a payment-provider interface with separate adapters.

Define a durable payment state machine, for example:

- `created`
- `pending`
- `requires_action`
- `succeeded`
- `failed`
- `cancelled`
- `expired`
- `refunded`

Use explicit allowed transitions.

Do not assume that every provider has the same callback protocol.

Read the official integration documentation for the actual selected Idram and ArCa gateway. Implement the provider-specific signing, verification, request formats, and callback rules required by that documentation.

Do not invent an ArCa endpoint, merchant credential format, signature algorithm, or Idram protocol.

If provider credentials or official specifications are unavailable, implement the adapter interface and clearly mark the real integration as unconfigured.

## 22.1 Payment trust boundary

The frontend is untrusted.

Never mark an order paid because:

- The browser returned to a success URL.
- The user manipulated a query parameter.
- A frontend API request contains `paid: true`.
- The client claims that a transaction succeeded.
- A callback lacks valid provider authentication.
- The amount matches but the merchant/order identity does not.
- A provider response is stale or belongs to another transaction.

Only a properly verified server-to-server callback or a server-side status check against the official provider can establish payment success.

The verified payment must match:

- Merchant identity.
- Internal order identity.
- Provider transaction reference.
- Expected currency.
- Exact expected amount.
- Expected transaction purpose.
- Valid provider signature or checksum.
- Valid payment state.
- Expected callback semantics.

Use constant-time comparison for secret-derived signatures where appropriate.

Validate the raw request body exactly as required by the provider protocol. Some signature systems require the original body bytes.

Never parse and reserialize a signed payload before verification if that changes its signature representation.

Validate callback timestamps, nonces, or replay protection where the provider supports them.

Use TLS in production.

## 22.2 Payment idempotency

Every provider transaction must have a durable local record.

Add appropriate unique indexes for provider transaction references and callback/event identifiers.

Process repeated callbacks idempotently.

If the same verified success callback arrives repeatedly:

- Do not create duplicate orders.
- Do not decrement stock again.
- Do not send duplicate fulfillment commands.
- Do not duplicate payment records.
- Do not repeatedly execute irreversible side effects.

Store a sanitized audit record sufficient for investigation.

Do not store payment secrets, full card data, CVV, or unnecessary sensitive callback contents.

## 22.3 Amount and order matching

The server must compare the callback amount to the amount expected for that specific order and payment attempt.

Never accept a payment simply because the callback has a valid signature.

Reject and safely audit mismatched order IDs, currencies, amounts, merchants, transaction references, or impossible state transitions.

Do not automatically mark a mismatched transaction as successful.

Define an incident/reconciliation path for provider-side success that cannot safely be applied to the local order.

## 22.4 Payment and stock lifecycle

Define exactly when stock is reserved, when it is consumed, and when it is released.

For online payment, use an explicit reservation timeout policy.

If payment succeeds after the reservation expires and inventory has been reallocated, do not silently oversell.

Create a safe reconciliation flow, such as a manual-review state and a documented refund process where applicable.

Never automatically fulfill an order with inconsistent inventory or payment state.

## 22.5 COD

Cash on delivery must work without third-party payment credentials.

COD order creation must still validate stock, calculate totals server-side, reserve inventory according to the documented order policy, and use idempotency.

COD does not mean that inventory protection or order validation can be skipped.

## 22.6 Development and live modes

Development-only mocks may simulate:

- Payment success.
- Payment failure.
- Pending status.
- Timeout.
- Duplicate callbacks.
- Invalid signatures.
- Wrong amounts.
- Delayed callbacks.

Mocks must be impossible to enable accidentally in production.

Fail startup in production if a mock payment mode is enabled.

Idram and ArCa must remain disabled until their required credentials and verified configuration exist.

Never expose provider secrets to the browser.

## 22.7 Payment test matrix

Test:

- Valid callback.
- Invalid signature.
- Missing signature.
- Altered amount.
- Wrong currency.
- Wrong order ID.
- Wrong merchant ID.
- Duplicate callback.
- Concurrent callbacks.
- Out-of-order callbacks.
- Expired payment.
- Cancelled payment.
- Provider timeout.
- Network failure.
- Retry behavior.
- Provider reports success but local transaction fails.
- Payment succeeds after inventory reservation expiration.
- Attempted refund twice.
- Client forges success URL.
- Customer accesses another user's payment status.
- Invalid provider transaction reference.

Every payment test must verify the resulting order, payment, inventory, audit log, and side-effect states.

---

# 23. PEXELS API AND IMAGE ASSETS

Use Pexels when useful for suitable visual assets, lifestyle imagery, background imagery, and editorial photography.

API documentation:

https://www.pexels.com/api/documentation/

Use the official API endpoints and current documentation.

For photo search, use the documented Pexels photo-search endpoint. Keep API requests on the backend unless a documented, safe public API configuration explicitly permits otherwise.

## 23.1 Secret handling

Configure:

`PEXELS_API_KEY`

Only in the backend environment.

Never:

- Prefix it with `NEXT_PUBLIC_`.
- Put it in frontend JavaScript.
- Return it in an API response.
- Commit it to Git.
- Print it in logs.
- Include it in a public build artifact.
- Put it in Playwright screenshots or test reports.
- Use it as a hardcoded source constant.

Use a placeholder in `.env.example`.

If a key was exposed in a conversation or repository, rotate it where possible.

## 23.2 Image discovery

Create an optional backend service for Pexels image search.

The service should:

- Validate and limit search queries.
- Restrict supported query parameters.
- Apply request timeouts.
- Handle provider errors.
- Handle rate limits.
- Avoid excessive API requests.
- Cache results where appropriate.
- Normalize the API response to a small, safe data structure.
- Return only required image metadata.
- Never allow the browser to use the backend as an unrestricted Pexels proxy.
- Record enough attribution metadata to credit photographers.

Use suitable searches for:

- Premium lifestyle.
- Minimal dark backgrounds.
- Modern retail imagery.
- Product-adjacent editorial images.
- Abstract textures.
- Suitable non-misleading promotional backgrounds.

Do not assume Pexels has authentic photographs of the exact products being sold. Product imagery must accurately represent the actual product.

Never use a generic lifestyle photograph as though it were a photograph of a specific product SKU.

Use genuine merchant-supplied product images wherever available.

## 23.3 Image quality and fallback

For every image slot, define:

- Appropriate aspect ratio.
- Object-fit behavior.
- Responsive size.
- Alt text.
- Loading behavior.
- Error fallback.
- Placeholder.
- Crop strategy.
- Image priority when above the fold.

Avoid layout shifts while images load.

Use lazy loading for below-the-fold images.

Prioritize only the genuinely critical hero image.

If Pexels is unavailable or the API key is missing, the storefront must still work. Use local licensed assets, admin-uploaded assets, or designed placeholders.

## 23.4 Attribution

Follow Pexels' current API guidelines.

Provide a visible Pexels credit/link where required by its current terms, and attribute photographers when possible using the returned photographer name and profile/photo URL.

Create `docs/assets.md` with:

- Asset purpose.
- Source.
- Attribution.
- Photographer.
- Original photo URL.
- License/usage notes.
- Whether the image is temporary or production-approved.

Do not scrape Pexels pages or bypass API limits.

Do not attempt to work around rate limits using multiple keys or other abusive methods.

## 23.5 Pexels tests

Test:

- Valid query.
- Empty query.
- Overlong query.
- Provider timeout.
- Rate-limit response.
- Malformed provider response.
- Missing API key.
- No search results.
- Attribution metadata.
- Safe response filtering.
- Confirmation that the key is absent from frontend bundles and browser responses.

---

# 24. CLOUDINARY MEDIA MANAGEMENT

Use Cloudinary for actual store product media and administrator-managed banners where configured.

Requirements:

- Admin-only uploads.
- Server-side signed uploads or a secure backend upload endpoint.
- Strict file-size limits.
- MIME type verification.
- File signature validation.
- Allowed image formats.
- Safe filenames.
- Rejection of unsupported or dangerous files.
- Rate limits on uploads.
- Image dimension limits.
- Safe transformations.
- Authorization for replace/delete/reorder operations.
- Orphaned asset cleanup.
- Graceful upload failure handling.
- Correct image ordering.
- Responsive delivery.

Store Cloudinary public IDs and metadata in MongoDB.

The Cloudinary API secret must never reach the browser.

Do not trust a user-supplied MIME type alone.

Do not permit arbitrary remote URL imports without SSRF protections.

Test unauthorized uploads, malformed files, oversized files, invalid signatures, replacement, deletion, and orphan cleanup.

---

# 25. ADMIN PANEL

Create a polished, responsive admin dashboard.

Admin interface language: English.

Protect the frontend routes and all backend admin endpoints.

Implement:

- Dashboard overview.
- Product management.
- Variant management.
- Category management.
- Brand management.
- Inventory management.
- Order management.
- Customer management.
- Blog management.
- Contact messages.
- Store settings.
- Shipping settings.
- VAT settings.
- Featured products.
- Promotional banners.
- Payment-provider configuration status.
- Upload management.
- Audit log.
- Admin account and MFA management.

Dashboard metrics should be calculated from actual persisted records.

Do not fabricate revenue or order counts.

## 25.1 Product CRUD

Create, view, update, archive, and safely delete products according to business rules.

Include:

- Localized names.
- Localized descriptions.
- Slugs.
- Brand.
- Category.
- Variants.
- SKU.
- Prices.
- Sale prices.
- Stock.
- Images.
- Tags.
- Active status.
- Featured status.
- SEO fields.

Enforce unique SKU constraints.

Prevent deletion or mutation from corrupting historical orders.

## 25.2 Inventory administration

Inventory adjustments must:

- Require appropriate authorization.
- Validate the requested change.
- Use atomic database operations.
- Record the previous and new stock values.
- Record the administrator.
- Record the reason.
- Be audit-logged.
- Avoid overwriting stock using stale client values.

Test simultaneous admin adjustments and checkout activity.

## 25.3 Order management

Administrators can view orders and update permitted states.

Every state transition must be checked by the backend state machine.

Require confirmation for sensitive actions such as cancellation or refund initiation.

Never treat a manually changed label as proof of payment.

Sensitive actions should be auditable.

## 25.4 Admin authentication and MFA

Admin accounts must be created through an explicit secure CLI command.

Never seed a default production administrator.

Never hardcode an admin password.

Require MFA for administrators.

Implement TOTP-based MFA with:

- Enrollment flow.
- QR code or provisioning URI.
- Secure secret storage.
- Verification before activation.
- Recovery codes.
- One-time recovery-code consumption.
- Rate limiting.
- Session protection.
- MFA reset procedures.
- Audit logs.

Encrypt MFA secrets at rest using an application-managed key from a secret store or equivalent secure configuration.

Do not store plaintext recovery codes.

Do not permit disabling MFA through an unauthenticated request or by editing a frontend flag.

Consider step-up authentication for especially sensitive actions.

Test MFA enrollment, invalid codes, replay attempts, recovery codes, lockout, and session restrictions.

---

# 26. SECURITY BASELINE

Perform a threat model before declaring the application complete.

Create a threat model covering:

- Customer account takeover.
- Administrator account takeover.
- Session theft.
- CSRF.
- XSS.
- NoSQL injection.
- Broken access control.
- IDOR/BOLA.
- SSRF.
- Path traversal.
- File upload abuse.
- Inventory races.
- Duplicate checkout.
- Payment callback forgery.
- Replay attacks.
- Brute-force attacks.
- Credential leakage.
- Sensitive log leakage.
- Denial of service.
- Email abuse.
- Misconfiguration.
- Dependency vulnerabilities.
- Unauthorized admin operations.
- Race conditions in refunds and order cancellation.

## 26.1 Authorization

Use explicit roles and permissions.

At minimum:

- Customer.
- Admin.

Never accept the role from a registration request.

Never trust a client-sent `isAdmin` value.

Every protected route must enforce authorization on the server.

Return appropriate 401/403 responses.

Ensure private resource queries are scoped to the authorized principal.

Test direct API access, not only UI restrictions.

## 26.2 Input validation

Validate every:

- Request body.
- Query parameter.
- Path parameter.
- Uploaded file.
- Provider callback.
- Admin configuration update.
- Search query.
- Pagination value.
- Sort field.
- Object identifier.

Use strict schemas.

Reject unexpected fields on sensitive mutations.

Use explicit field allowlists.

Protect against NoSQL operator injection.

Do not pass arbitrary client objects directly into Mongoose filters or update operations.

Never accept client-supplied database operators.

## 26.3 HTTP security

Configure:

- HTTPS in production.
- Helmet or equivalent.
- A strict Content Security Policy.
- HSTS in production.
- Appropriate Referrer-Policy.
- Appropriate X-Content-Type-Options.
- Clickjacking protection.
- Strict CORS allowlist.
- Secure cookie flags.
- Request body size limits.
- Request timeouts.
- Rate limits.
- Safe error responses.

Do not use permissive wildcard CORS with credentials.

Do not weaken CSP merely to make an untrusted third-party script work.

Document the intended frontend and backend origins.

## 26.4 Rate limiting

Apply rate limits to:

- Login.
- Admin login.
- Registration.
- Forgot password.
- Reset password.
- Search.
- Contact form.
- Checkout.
- Order creation.
- Uploads.
- Payment initiation.
- Public tracking/status endpoints.

Use appropriate account/IP combinations where feasible.

Be careful with shared NAT addresses and avoid unnecessarily locking out legitimate customers.

In multi-instance production deployments, use a shared rate-limit store rather than relying exclusively on in-memory counters.

## 26.5 Database protection

Use a dedicated database user with least privilege.

Require TLS in production.

Use authenticated connections.

Document backup policy, retention, encryption, and restore tests.

Do not expose MongoDB publicly without appropriate network controls.

Do not expose database errors or internal query details to clients.

Use indexes for critical queries and uniqueness constraints.

Test indexes and data-integrity constraints.

## 26.6 Logging and audit

Use structured logs.

Redact:

- Passwords.
- Session identifiers.
- Reset tokens.
- API keys.
- Payment secrets.
- Authorization headers.
- MFA secrets.
- Full sensitive callback payloads.
- Sensitive personal data not required for debugging.

Audit-log sensitive operations, including:

- Admin login and MFA events.
- Product price changes.
- Inventory adjustments.
- Order-state transitions.
- Refund actions.
- Payment reconciliation.
- User deactivation.
- MFA reset.
- Settings changes.
- Upload operations.

Logs must not become an alternative database for sensitive user data.

## 26.7 Secret management

Use `.env.example` with placeholders only.

Validate required environment variables at startup.

Fail fast on missing production-critical configuration.

Keep production secrets in a managed secret store or equivalent protected deployment configuration.

Never commit real credentials.

Never print secrets during startup.

Run secret scanning in CI.

If any credential has been exposed, rotate it and document the remediation.

## 26.8 Dependency and supply-chain security

Run dependency vulnerability scanning.

Use lockfiles.

Use automated dependency update workflows with review.

Pin actions or dependencies appropriately for the chosen risk model.

Do not install abandoned packages without justification.

Run static analysis and secret scanning in CI.

Document how critical vulnerabilities are triaged.

---

# 27. DATABASE DESIGN

Design and document the schema before implementing business logic.

Expected entities include:

- User.
- Session.
- Address.
- Product.
- Product variant.
- Category.
- Brand.
- Cart.
- Cart item.
- Inventory reservation.
- Order.
- Order item snapshot.
- Payment transaction.
- Payment event or callback receipt.
- Password reset token.
- MFA configuration.
- MFA recovery code.
- Audit log.
- Store settings.
- Blog post.
- Contact message.
- Email/outbox job.

Use indexes for:

- Unique normalized email.
- Unique SKU.
- Unique product slug where appropriate.
- Unique order number.
- Provider transaction reference.
- Idempotency keys.
- Session expiry.
- Password reset expiry.
- User order history.
- Active inventory reservations.
- Audit log chronology.
- Search and catalog filtering.

Use schema validation and database-level uniqueness where possible.

Document every important index and why it exists.

Do not rely on application validation alone for uniqueness under concurrency.

Use transactions for related multi-document changes.

Document the transaction boundaries for:

- Checkout.
- Inventory reservation.
- Order cancellation.
- Reservation expiration.
- Payment success.
- Refund state changes.

---

# 28. API DESIGN

Use REST under `/api/v1`.

Document request and response schemas in OpenAPI.

Use consistent response shapes and error codes.

Include request correlation IDs.

Never return internal stack traces to the browser in production.

Expected route groups:

## Authentication

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `PATCH /api/v1/auth/me`
- `PATCH /api/v1/auth/me/password`

## Catalog

- `GET /api/v1/products`
- `GET /api/v1/products/:slug`
- `GET /api/v1/categories`
- `GET /api/v1/brands`

## Cart

- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PATCH /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart/items/:itemId`
- `POST /api/v1/cart/merge`

## Orders

- `POST /api/v1/orders`
- `GET /api/v1/orders/my-orders`
- `GET /api/v1/orders/:id`

## Payments

- `POST /api/v1/payments/idram/initiate`
- `POST /api/v1/payments/idram/callback`
- `POST /api/v1/payments/arca/initiate`
- `POST /api/v1/payments/arca/callback`
- `GET /api/v1/payments/status/:orderId`

Use the exact callback method and body format required by each provider.

Payment callback routes may require provider-specific handling of raw request bodies, authentication, and rate limiting.

## Content

- `GET /api/v1/blog`
- `GET /api/v1/blog/:slug`
- `POST /api/v1/contact`
- `GET /api/v1/settings/public`

## Pexels

- `GET /api/v1/media/pexels/search`

This endpoint must be restricted, validated, rate-limited, and safely normalized. It must not expose the Pexels API key.

## Admin

- Dashboard.
- Products.
- Categories.
- Brands.
- Inventory.
- Orders.
- Users.
- Blog.
- Contact messages.
- Settings.
- Uploads.
- Audit logs.
- Admin MFA management.

All admin routes require backend authorization.

## Operations

- `GET /health`
- `GET /ready`

Health checks must not disclose secrets, credentials, internal network details, or database connection strings.

The readiness endpoint may verify critical dependencies but must return only safe operational information.

---

# 29. EMAILS AND NOTIFICATIONS

Implement localized emails for:

- Welcome.
- Password reset.
- Order confirmation.
- Payment pending.
- Payment confirmation.
- Payment failure where appropriate.
- Order status update.
- Shipping notification.
- Cancellation.
- Refund status.
- New-order admin notification.
- Contact form receipt where appropriate.

Use responsive HTML templates with a text fallback.

Requirements:

- Correct locale.
- Correct AMD formatting.
- Accurate order details.
- No sensitive payment secrets.
- No password-reset token in logs.
- Retryable delivery.
- No duplicate emails from duplicate payment callbacks.
- Reliable outbox processing for critical notifications.
- Clear handling of email provider failures.

Do not block successful checkout on a noncritical email provider outage.

Test template rendering, localization, delivery failure, retry, and duplicate event handling.

---

# 30. CONTENT PAGES

Implement:

- About Us.
- Contact.
- FAQ.
- Blog list.
- Blog article.
- Privacy Policy.
- Terms and Conditions.
- Shipping and Returns.
- 404 page.
- Error page.

Content must be available in Armenian, Russian, and English where required.

Admin should be able to manage suitable editable content.

Contact forms must be validated, rate-limited, protected against abuse, and safely persisted.

Do not claim that legal text is legally approved.

Mark legal content as requiring review by a qualified Armenian legal professional before launch.

---

# 31. LOADING IS MANDATORY EVERYWHERE

This is a critical product requirement.

Every asynchronous action must provide appropriate feedback.

The user must never wonder whether a button worked, whether the site is frozen, or whether a request is still running.

A loading spinner alone is not sufficient for every page. Use the right loading pattern for the context.

## 31.1 Global loading principles

Every async action must have:

- A clear initial state.
- A pending/loading state.
- A successful completion state.
- A recoverable error state.
- A disabled or guarded state where duplicate actions are unsafe.

Where relevant, include:

- Progress feedback.
- Skeleton placeholders.
- Retry controls.
- Empty states.
- Optimistic updates with rollback.
- Screen-reader announcements.
- Request cancellation.
- Stale-response protection.
- Timeouts.
- Offline/error recovery.

Never leave a button permanently loading after a request fails.

Never silently swallow an error.

Never show success before the server confirms the operation.

## 31.2 Navbar loading

Search suggestions must show a loading indicator while fetching.

Account controls must handle session restoration without flashing protected content.

Cart count must load safely and must not falsely display zero merely because the request failed.

Language switching must not leave the user on an invalid route.

## 31.3 Catalog loading

Use page-level skeletons or product-card skeletons while fetching.

Maintain a stable layout to prevent cumulative layout shift.

When changing filters, prevent old responses from overwriting newer results.

Handle slow network conditions.

Show a useful error state with a retry action.

If filters produce no results, show an empty state rather than an infinite spinner.

## 31.4 Product loading

Use a stable gallery placeholder.

Load variant data and price changes with clear feedback.

Disable invalid actions while the selected variant is being verified.

Do not display stale stock as though it were authoritative.

## 31.5 Cart loading

Show line-item skeletons while loading the cart.

Show per-item pending state when updating quantity or removing a product.

Prevent conflicting mutations for the same cart line.

Do not replace the entire cart with a blank page after a small quantity change.

Show a clear message if stock or price changed.

## 31.6 Checkout loading

Checkout requires explicit states:

- Initial checkout validation.
- Submitting order.
- Reserving inventory.
- Creating payment attempt.
- Redirecting to provider.
- Awaiting provider confirmation.
- Verifying payment.
- Order confirmed.
- Payment failed.
- Payment pending.
- Reservation expired.
- Network error.
- Recoverable retry state.

Do not pretend that a payment succeeded while waiting for confirmation.

Do not allow repeated clicks to create duplicate orders.

If the browser loses connection during submission, allow the user to safely recover the operation using its idempotency key or order status.

## 31.7 Admin loading

Every admin table must have:

- Initial skeleton.
- Empty state.
- Error state.
- Retry.
- Pagination loading.
- Mutation loading.
- Success feedback.
- Failure feedback.

For long-running operations, provide clear progress or status feedback.

Destructive operations require a confirmation step.

## 31.8 Forms

Every form must have:

- Field-level validation.
- Server-error display.
- Submission loading state.
- Disabled duplicate submission.
- Focus management after errors where appropriate.
- Success feedback.
- Recovery guidance.

Use `aria-live` or an equivalent accessible announcement for relevant async updates.

## 31.9 Image loading

Every image must have an intentional loading strategy.

Avoid layout jumps.

Use placeholders and fallback images.

Do not show broken image icons without recovery.

## 31.10 Loading-state tests

For every important async component, test:

1. Initial state.
2. Pending state.
3. Success state.
4. Error state.
5. Retry state.
6. Duplicate-click protection.
7. Unmount/cancellation behavior where relevant.
8. Accessibility of the loading announcement.
9. Slow-response behavior.
10. Request failure behavior.

Use Playwright network interception to simulate delayed responses, 4xx errors, 5xx errors, aborted requests, and offline scenarios.

No critical user action may remain without tested loading and error handling.

---

# 32. TESTING STRATEGY — TEST EVERY FUNCTIONALITY

Testing is not an optional final phase.

Write tests while implementing each feature.

Every implemented feature must have an explicit test plan.

Every bug discovered must result in a regression test whenever practical.

Never write tests that merely repeat the implementation's assumptions without asserting the expected business outcome.

Never hide failures with overly broad mocks.

Never mark a test as passed when it was skipped.

## 32.1 Frontend unit tests

Use Vitest and React Testing Library.

Test:

- Currency formatting.
- VAT display.
- Shipping calculations where represented in frontend utilities.
- Locale switching.
- Product cards.
- Variant selectors.
- Quantity selectors.
- Search behavior.
- Cart controls.
- Form validation.
- Loading skeletons.
- Empty states.
- Error states.
- Toasts.
- Modals.
- Navbar dropdown.
- Mobile navigation.
- Cart drawer.
- Checkout form.
- Admin forms.
- Permission-dependent UI.
- Accessibility labels.
- Reduced-motion behavior.
- Image fallback.
- Retry controls.

Business-critical calculations must also be independently tested on the backend.

## 32.2 Backend unit tests

Test:

- Validation schemas.
- Password policies.
- Email normalization.
- Price calculations.
- VAT calculation and rounding.
- Shipping calculations.
- Discount validation.
- Order-state transitions.
- Payment-state transitions.
- Idempotency rules.
- Reservation expiration.
- Inventory adjustment validation.
- Callback signature verification.
- Provider response normalization.
- Error mapping.
- Authorization policies.
- Configuration validation.
- Pexels query normalization.
- Email template rendering.

## 32.3 Backend integration tests

Use a real MongoDB test replica set where transactions and indexes matter.

Test:

- Registration and duplicate account prevention.
- Login and logout.
- Session rotation.
- Password reset.
- MFA.
- Product CRUD.
- Variant CRUD.
- SKU uniqueness.
- Catalog filtering.
- Search.
- Cart persistence.
- Guest cart merge.
- Server-side price recalculation.
- Shipping calculation.
- Order creation.
- Inventory reservation.
- Order cancellation.
- Reservation expiration.
- Payment initiation.
- Payment callback processing.
- Duplicate callbacks.
- Refund idempotency.
- Admin authorization.
- Upload validation.
- Email outbox.
- Audit logs.
- Database transaction rollback.
- Recovery after transient failure.

## 32.4 Security tests

Explicitly test:

- Unauthenticated access to private routes.
- Customer access to admin endpoints.
- Forged role fields.
- Cross-user order access.
- Cross-user address access.
- Cross-user cart access.
- Session fixation.
- Session reuse after logout.
- Expired session use.
- Expired reset token.
- Reset token reuse.
- CSRF attacks.
- Invalid Origin.
- Disallowed CORS origin.
- NoSQL injection payloads.
- XSS payloads.
- Mass-assignment attempts.
- Path traversal.
- SSRF attempts.
- Malformed identifiers.
- Oversized request bodies.
- Upload spoofing.
- Rate-limit enforcement.
- Payment callback forgery.
- Payment amount mismatch.
- Payment replay.
- Pexels key exposure.
- Secret leakage in logs.
- Unsafe error messages.
- Admin MFA bypass attempts.

Use safe test payloads. Do not perform unauthorized destructive testing against production systems.

## 32.5 Contract tests

Use OpenAPI as the API contract.

Test that:

- Actual request validation matches the contract.
- Response shapes match the documented schemas.
- Error responses are consistent.
- Authentication requirements are accurate.
- Pagination and filtering parameters are documented.
- The frontend uses supported endpoints.
- API changes do not silently break the frontend.

Document the process for updating the contract independently in both repositories.

---

# 33. PLAYWRIGHT — FULL FRONTEND BROWSER TESTING

Playwright is mandatory.

It must test the real application through a browser, interacting with the frontend and backend as a user would.

Do not substitute component tests for browser tests.

Do not claim the frontend is fully tested after only checking the homepage.

Create a dedicated `e2e/` test suite in the frontend repository.

Use stable test IDs where needed, but prefer accessible roles and labels.

Avoid brittle selectors based on implementation-specific DOM structure.

## 33.1 Playwright environments

Configure:

- Local development.
- Test environment.
- CI environment.

Use a dedicated test database and isolated test accounts.

Never run destructive tests against production.

Provide a safe way to start the frontend and backend for E2E testing.

Do not let tests silently connect to a production database.

Support deterministic fixtures created through test setup APIs or dedicated test helpers.

## 33.2 Navigation tests

Test:

- Homepage.
- Shop dropdown.
- Shop Grid.
- Shop Grid (Sidebar).
- About Us.
- Search overlay.
- Account.
- Cart.
- Footer links.
- Breadcrumbs.
- Mobile hamburger.
- Keyboard navigation.
- Escape behavior.
- Direct URL navigation.
- Unknown route/404.
- Refresh on nested routes.

Verify every visible interactive navigation element.

## 33.3 Catalog tests

Test:

- Product list.
- Pagination.
- Sorting.
- Category filter.
- Brand filter.
- Flavor filter.
- Nicotine filter.
- Price range.
- In-stock filter.
- Multiple simultaneous filters.
- URL query persistence.
- Browser back/forward.
- No results.
- Loading skeletons.
- Server error.
- Retry.
- Missing product.
- Out-of-stock product.

## 33.4 Product detail tests

Test:

- Product images.
- Gallery selection.
- Variant switching.
- SKU update.
- Price update.
- Stock update.
- Quantity increment/decrement.
- Maximum quantity.
- Disabled unavailable variant.
- Add to cart.
- Success feedback.
- Loading state.
- Duplicate click.
- Backend failure.
- Related product navigation.

## 33.5 Cart tests

Test:

- Add item.
- Update quantity.
- Remove item.
- Empty cart.
- Cart drawer.
- Full cart page.
- Cart persistence.
- Guest cart.
- Login merge.
- Price change.
- Stock reduction.
- Unavailable variant.
- Loading states.
- API errors.
- Multiple tabs where relevant.

## 33.6 Authentication tests

Test:

- Registration.
- Duplicate email.
- Invalid email.
- Invalid password.
- Login.
- Incorrect credentials.
- Logout.
- Forgot password.
- Reset password.
- Expired reset token.
- Session persistence.
- Session revocation.
- Protected account routes.
- Generic error messages.
- Rate-limit response.

Use test-only email capture rather than exposing real reset tokens in production logs.

## 33.7 Checkout tests

Test:

- Valid COD checkout.
- Invalid customer details.
- Missing address.
- Missing adult confirmation.
- Missing terms acceptance.
- Shipping fee for Yerevan.
- Shipping fee for other regions.
- Free shipping threshold.
- VAT calculation display.
- Server-side total recalculation.
- Stock conflict.
- Double submission.
- Request timeout.
- Retry after uncertain network result.
- Order confirmation.
- Order history update.
- Email outbox event.
- Reservation expiration.

## 33.8 Payment tests

Use explicit test-mode providers.

Test:

- Payment initiation.
- Pending state.
- Simulated success.
- Simulated failure.
- Timeout.
- Forged success redirect.
- Duplicate callback.
- Wrong amount.
- Invalid signature.
- Payment status polling.
- Recovery after reload.
- Delayed callback.
- Callback after reservation expiration.
- No secret exposure in browser traffic.

Mocks must be test-only and impossible to activate in production.

## 33.9 Admin tests

Test:

- Unauthorized user blocked from admin pages.
- Customer blocked from admin APIs.
- Admin login.
- MFA enrollment.
- Valid MFA.
- Invalid MFA.
- Recovery code.
- Product creation.
- Product edit.
- Variant creation.
- SKU uniqueness error.
- Inventory adjustment.
- Order state update.
- Invalid order transition.
- Settings update.
- Image upload.
- Upload failure.
- Audit-log visibility.
- Destructive-action confirmation.
- Loading, success, and error states.

## 33.10 Responsive browser tests

Run critical journeys at mobile, tablet, and desktop viewports.

Test:

- Mobile navigation.
- Search overlay.
- Product grid.
- Product gallery.
- Cart drawer.
- Checkout.
- Admin tables.
- Modal sizing.
- Keyboard and touch interactions.

Verify there is no horizontal overflow.

## 33.11 Accessibility browser tests

Run axe-core on critical routes.

Test keyboard navigation.

Test visible focus.

Test modal focus behavior.

Test accessible names.

Test form errors.

Test loading announcements.

Test reduced-motion preferences.

Automated accessibility tests do not replace manual review, but must be included in CI.

## 33.12 Browser resilience tests

Use Playwright request interception to simulate:

- Slow network.
- Failed API requests.
- HTTP 400.
- HTTP 401.
- HTTP 403.
- HTTP 404.
- HTTP 409 stock conflict.
- HTTP 422 validation failure.
- HTTP 429 rate limit.
- HTTP 500.
- Aborted request.
- Offline mode.
- Image failure.
- Delayed payment status.
- Session expiration during navigation.

Verify that the interface remains understandable and recoverable.

## 33.13 Playwright reports

Configure:

- HTML report.
- Screenshots on failure.
- Trace on retry or failure.
- Video where useful in CI.
- Test retries in CI with transparent reporting.
- Console-error capture.
- Page-error capture.
- Failed-network-request capture.

Do not use retries to hide flaky tests.

Do not store secrets or sensitive customer data in traces, screenshots, or videos.

Run the full Playwright suite before claiming frontend completion.

---

# 34. TEST COVERAGE AND FEATURE INVENTORY

Maintain a feature inventory document in the frontend and backend repositories.

For each feature record:

- Feature name.
- Implementation location.
- API endpoints.
- Authorization requirements.
- Loading behavior.
- Error behavior.
- Unit tests.
- Integration tests.
- Playwright tests where relevant.
- Security tests where relevant.
- Current status.
- Known gaps.

No critical feature may be marked complete unless its applicable tests exist and pass.

Use coverage reports to identify untested logic.

Set meaningful coverage thresholds for critical business logic, services, utilities, and authorization rules.

A high aggregate coverage percentage must not conceal untested payment or inventory logic.

Focus especially on:

- Payment verification.
- Order state transitions.
- Inventory concurrency.
- Session security.
- Authorization.
- Price calculation.
- Reservation lifecycle.

Document uncovered code and explain whether it is intentional.

Do not inflate coverage by testing trivial getters while leaving critical business behavior untested.

---

# 35. ACCESSIBILITY

Target WCAG 2.2 AA where applicable.

Implement:

- Semantic HTML.
- Correct heading hierarchy.
- Accessible form labels.
- Keyboard navigation.
- Visible focus indicators.
- Sufficient contrast.
- Accessible modal behavior.
- Accessible dropdowns.
- Accessible cart controls.
- Screen-reader announcements.
- Alternative text for meaningful images.
- Decorative images hidden from assistive technologies.
- Reduced-motion support.
- Errors associated with relevant fields.
- Touch-friendly targets.
- Correct language attributes.

Test with automated tooling and perform manual keyboard checks.

Do not use color alone to communicate an error or success state.

---

# 36. PERFORMANCE AND SEO

Optimize for real user experience.

Implement:

- Server rendering for SEO-critical pages.
- Appropriate caching.
- Cache invalidation for catalog/admin changes.
- Responsive image delivery.
- Lazy loading below the fold.
- Minimal client-side JavaScript.
- Dynamic imports for suitable heavy features.
- Stable layout dimensions.
- Efficient database indexes.
- Pagination rather than unbounded catalog responses.
- Debounced search.
- Query timeouts where appropriate.
- Appropriate compression.
- Correct metadata.
- Canonical URLs.
- Sitemap.
- Robots configuration.
- Localized metadata.
- `hreflang`.
- Product structured data.
- Correct 404 behavior.

Do not cache private account data in shared caches.

Do not publicly cache payment status or authenticated cart responses.

Measure key pages and document results.

Aim for strong Lighthouse scores, preferably 90+ in applicable categories on key pages, without sacrificing correctness, accessibility, or security.

Do not claim a performance score unless it has been measured.

---

# 37. EMAIL, BACKGROUND WORKERS AND RELIABILITY

Use reliable background processing for operations that should not depend on a single HTTP request finishing successfully.

Examples:

- Expired reservation processing.
- Email delivery.
- Outbox event dispatch.
- Safe cleanup tasks.
- Payment reconciliation where supported.

Requirements:

- Idempotent jobs.
- Retry limits.
- Exponential backoff where appropriate.
- Dead-letter or failed-job visibility.
- Structured logging.
- Graceful shutdown.
- Duplicate-job protection.
- Safe recovery after restart.
- Metrics or health information that does not expose secrets.

Do not rely on a browser remaining open to complete a critical backend operation.

Document worker deployment and operational monitoring.

---

# 38. ENVIRONMENT CONFIGURATION

Create `.env.example` in each repository.

Frontend example variables may include:

- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `NODE_ENV`

Only expose values that are intentionally public.

Backend example variables may include:

- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `BACKEND_URL`
- `MONGODB_URI`
- `SESSION_SECRET`
- `COOKIE_DOMAIN`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `PEXELS_API_KEY`
- `IDRAM_*`
- `ARCA_*`
- `PAYMENT_MODE`
- `MFA_ENCRYPTION_KEY`
- `LOG_LEVEL`

Use the exact provider-specific variable names documented by the selected adapters.

Do not invent real credentials.

Validate configuration at startup.

Fail fast if a required production variable is missing or invalid.

Never use a development secret as a production fallback.

Do not print environment values during startup.

Document how to rotate secrets.

---

# 39. CI/CD

Each repository has its own GitHub Actions workflow.

Frontend CI must run:

1. Dependency installation.
2. Lockfile consistency check.
3. Formatting/lint.
4. TypeScript checks.
5. Unit tests.
6. Component tests.
7. Accessibility checks where configured.
8. Production build.
9. Playwright E2E tests.
10. Dependency vulnerability scan.
11. Secret scanning.

Backend CI must run:

1. Dependency installation.
2. Lockfile consistency check.
3. Formatting/lint.
4. TypeScript checks.
5. Unit tests.
6. Integration tests.
7. Concurrency tests.
8. Security tests.
9. API contract checks.
10. Production build.
11. Dependency vulnerability scan.
12. Secret scanning.

Use a safe MongoDB replica-set service for tests that require transactions.

Fail CI on critical test failures.

Do not silently skip tests because a provider credential is unavailable. Separate credential-dependent live integration tests from deterministic adapter-contract tests and clearly report the distinction.

Use environment protection and approval controls for production deployment.

Never deploy a build that knowingly fails critical security, payment, or inventory tests.

---

# 40. DOCUMENTATION AND DEVELOPER EXPERIENCE

Each repository must have a complete README.

Include:

- Project purpose.
- Architecture.
- Prerequisites.
- Node version.
- Installation.
- Environment setup.
- Local development.
- Test commands.
- Build commands.
- Lint and typecheck commands.
- E2E testing instructions.
- Troubleshooting.
- Deployment.
- Security notes.
- Integration setup.
- Known limitations.

Backend documentation must explain:

- MongoDB replica set requirements.
- Database indexes.
- Transaction boundaries.
- Session design.
- Inventory reservation lifecycle.
- Payment adapter setup.
- Callback verification.
- Admin creation.
- MFA recovery.
- Worker processes.
- Backups and restore testing.

Frontend documentation must explain:

- Routes.
- Localization.
- Design system.
- API configuration.
- Loading-state conventions.
- Playwright setup.
- Test accounts and safe test fixtures.
- Image configuration.
- Accessibility testing.

Add:

- `DECISIONS.md`.
- `PROGRESS.md`.
- `SECURITY.md`.
- `CONTRIBUTING.md` where appropriate.
- `docs/feature-test-matrix.md`.

Do not document commands that do not exist.

Run the documented commands and correct the documentation if they fail.

---

# 41. DEVELOPMENT MILESTONES

Work through the following milestones in order, but continue until the defined scope is implemented as far as the environment permits.

## Milestone 1: Repository and architecture setup

- Inspect the existing environment.
- Create two independent Git repositories.
- Configure frontend and backend separately.
- Set up TypeScript and linting.
- Configure environment validation.
- Create architecture documentation.
- Establish the API contract.
- Configure test infrastructure.
- Configure CI for each repository.

Run initial checks.

## Milestone 2: Reference analysis and design system

- Inspect the reference website.
- Record design tokens.
- Implement typography, colors, spacing, and layout primitives.
- Build navbar and footer.
- Implement localization.
- Implement age gate.
- Implement cookie behavior where needed.
- Implement cursor trail.
- Implement responsive layouts.
- Implement global loading and error patterns.

Write tests before moving on.

## Milestone 3: Database and catalog

- Define schemas.
- Define indexes.
- Implement product and variant APIs.
- Implement categories and brands.
- Implement catalog filtering and pagination.
- Implement product detail.
- Implement image handling.
- Implement Pexels discovery adapter.
- Implement Cloudinary uploads.
- Write unit and integration tests.
- Add Playwright catalog tests.

## Milestone 4: Authentication and account

- Registration.
- Login.
- Server-side sessions.
- Logout.
- Password reset.
- Profile.
- Saved addresses.
- Order history shell.
- Admin MFA foundation.
- Rate limiting.
- Authorization.
- Email workflows.

Test all security boundaries.

## Milestone 5: Cart and pricing

- Guest cart.
- Authenticated cart.
- Cart merge.
- Variant validation.
- Price calculations.
- VAT.
- Shipping.
- Loading and error states.
- Cart drawer.
- Cart page.

Write component, service, API, and Playwright tests.

## Milestone 6: Inventory and checkout

- Atomic stock updates.
- Inventory reservations.
- Reservation expiration.
- Idempotent order creation.
- Order snapshots.
- Order state machine.
- Concurrency tests.
- COD checkout.
- Recovery flows.

Do not proceed until the critical inventory invariants are demonstrated by automated tests.

## Milestone 7: Payment integrations

- Payment adapter interface.
- Idram adapter.
- ArCa adapter.
- Callback verification.
- Idempotency.
- Payment state machine.
- Reconciliation behavior.
- Development mocks.
- Payment security tests.
- Playwright payment journeys.

Document any provider configuration that remains unavailable.

## Milestone 8: Admin dashboard

- Dashboard metrics.
- Product CRUD.
- Variant CRUD.
- Inventory management.
- Order management.
- Customer management.
- Content management.
- Settings.
- Uploads.
- Audit logs.
- MFA enforcement.

Test every admin action and every authorization boundary.

## Milestone 9: Complete browser testing

- Full Playwright suite.
- Mobile viewports.
- Keyboard navigation.
- Accessibility.
- Network failure scenarios.
- Session expiry.
- Concurrency-related checkout behavior.
- Payment callback scenarios.
- Admin security scenarios.

Fix failures instead of ignoring them.

## Milestone 10: Production readiness

- Dependency scanning.
- Secret scanning.
- Security review.
- Threat model review.
- Performance checks.
- SEO checks.
- Accessibility checks.
- Database backup/restore documentation.
- Deployment instructions.
- Operational health checks.
- Final test reports.

At the end of each milestone:

1. Run relevant lint checks.
2. Run TypeScript checks.
3. Run relevant tests.
4. Run the production build where applicable.
5. Fix failures.
6. Update `PROGRESS.md`.
7. Update documentation.
8. Commit completed work in the appropriate repository with a clear message.

Never commit secrets.

Never mark an unfinished milestone as complete.

---

# 42. DEFINITION OF DONE

The project is not complete until all applicable requirements below have been verified.

## Storefront

- [ ] The design follows the reference's visual direction.
- [ ] Navbar and dropdowns work.
- [ ] Mobile navigation works.
- [ ] Cursor trail works only where appropriate.
- [ ] All supported languages work.
- [ ] Product catalog uses the backend.
- [ ] Search works.
- [ ] Product variants work.
- [ ] Cart works.
- [ ] Checkout works.
- [ ] Account pages work.
- [ ] Content pages exist.
- [ ] All critical loading states exist.
- [ ] Empty and error states are usable.
- [ ] Images have fallbacks.
- [ ] No dead buttons or fake interactions remain.

## Inventory and checkout

- [ ] All prices are recalculated server-side.
- [ ] VAT and shipping are correct.
- [ ] Checkout is idempotent.
- [ ] Inventory uses atomic conditional updates.
- [ ] Reservations expire safely.
- [ ] Stock is never negative.
- [ ] The final unit cannot be sold twice.
- [ ] Cancellation and expiration cannot restore stock twice.
- [ ] Concurrency tests pass against MongoDB replica-set infrastructure.

## Payments

- [ ] COD works.
- [ ] Idram adapter follows official provider documentation.
- [ ] ArCa adapter follows the selected gateway's official documentation.
- [ ] Live providers are disabled when configuration is missing.
- [ ] Callback signatures are verified.
- [ ] Amount and order matching are verified.
- [ ] Duplicate callbacks are idempotent.
- [ ] Client redirects never establish payment success.
- [ ] Payment state transitions are validated.
- [ ] Payment tests cover failure and race scenarios.
- [ ] Unavailable live integration tests are documented honestly.

## Security

- [ ] Sessions are server-side and revocable.
- [ ] Passwords use Argon2id.
- [ ] Password reset tokens are hashed and single-use.
- [ ] CSRF protection is tested.
- [ ] Admin MFA is enforced.
- [ ] Admin routes are protected server-side.
- [ ] Authorization is tested for every private resource.
- [ ] Rate limits are implemented.
- [ ] Security headers are configured.
- [ ] CORS is restrictive.
- [ ] Uploads are validated.
- [ ] Logs redact secrets.
- [ ] Database access follows least privilege.
- [ ] Secret scanning is enabled.
- [ ] Dependency scanning is enabled.
- [ ] Threat model is documented.

## Testing

- [ ] Unit tests exist for business logic.
- [ ] Integration tests exist for backend features.
- [ ] Security tests exist for critical boundaries.
- [ ] Concurrency tests exist.
- [ ] Frontend component tests exist.
- [ ] Playwright tests cover all critical user journeys.
- [ ] Loading, success, error, and retry states are tested.
- [ ] Responsive layouts are tested.
- [ ] Accessibility checks run.
- [ ] CI runs the required test suites.
- [ ] Test reports are generated.
- [ ] No critical tests are silently skipped.

## Repository structure and deployment

- [ ] Frontend is a separate Git repository.
- [ ] Backend is a separate Git repository.
- [ ] No monorepo/workspace setup exists.
- [ ] Each repository has its own dependencies and lockfile.
- [ ] Each repository builds independently.
- [ ] Each repository has its own CI workflow.
- [ ] Environment variables are documented.
- [ ] No real credentials are committed.
- [ ] README setup instructions have been tested.
- [ ] Deployment instructions are complete.
- [ ] Database recovery procedures are documented.

---

# 43. FINAL EXECUTION INSTRUCTIONS

Start by inspecting the available environment and the existing project files.

Then create or configure the two independent Git repositories.

Read the visual reference and produce the design notes.

Build the application in the milestones above.

Write tests while implementing each feature—not after everything else has been written.

Treat loading states as required functionality, not decorative polish.

Treat payment verification and inventory concurrency as critical correctness requirements.

If a test reveals a defect, fix the underlying implementation and add a regression test.

If a real external integration cannot be verified, document the limitation and never represent a mock as a live integration.

Do not stop after generating files. Run the actual checks.

At the end, provide a concise but complete implementation report containing:

1. Repositories created.
2. Features implemented.
3. Important architecture decisions.
4. Security controls implemented.
5. Payment integrations verified versus still requiring credentials.
6. Inventory concurrency guarantees and the exact tests run.
7. Unit test results.
8. Integration test results.
9. Playwright test results.
10. Accessibility and performance results.
11. Build and typecheck results.
12. Remaining blockers.
13. Exact commands to run the frontend and backend independently.
14. Exact commands to run all tests.
15. Exact next steps before production deployment.

Never fabricate test counts, coverage percentages, Lighthouse scores, integration success, or deployment status.

**Begin implementation now. Inspect the available files, create the independent frontend and backend repositories, document the design, and proceed through the milestones until the application is genuinely working and verified.**