# Payment integrations

| Method | Status | Verified live? |
| --- | --- | --- |
| Cash on delivery (`cod`) | Implemented, always available | Yes (internal flow, covered by integration tests) |
| Mock provider (`mock`) | Implemented, **development/test only** | Simulated only — not a real provider |
| Idram (`idram`) | Adapter implemented from the merchant interface document; disabled unless configured | **No** — no merchant credentials were available |
| ArCa (`arca`) | Adapter implemented from secondary sources; disabled unless configured | **No** — the official bank manual was not available |

No live payment was processed while building this project. Do not enable `PAYMENT_MODE=live` for Idram or ArCa
before completing an authorized test with the provider.

## Trust model (all providers)

- The browser is untrusted. Returning to a success URL, query parameters or client claims never change payment
  state. The storefront success page only reads `GET /api/v1/payments/status/:number`.
- State changes come only from `applyVerifiedPayment()` after provider verification. It checks the merchant
  order, provider reference, currency `AMD` and **exact amount** against the local payment record, rejects and
  audits mismatches, and applies the transition idempotently (unique `PaymentEvent(provider, eventKey)` plus
  conditional updates inside one transaction).
- Duplicate or concurrent callbacks: one applies, the rest return `duplicate`; emails are deduplicated by outbox key.
- Late success after the reservation expired: atomic re-reserve, otherwise `reconciliation.required` on the order
  (admin must refund). Payments for cancelled orders are flagged the same way. Flagged orders cannot be moved
  through fulfilment transitions until reconciled.
- No provider secret is ever sent to the browser or stored in logs; callback summaries are sanitized.

## Idram

Source: *Idram Payment System merchant interface description* (Idram merchant API document, viewed via
https://www.slideshare.net/slideshow/idram-merchant-api-idram-payment-system-merchant-interface-description/228443396).
Implemented exactly as documented:

- Payment form fields: `EDP_LANGUAGE` (AM/RU/EN), `EDP_REC_ACCOUNT`, `EDP_DESCRIPTION`, `EDP_AMOUNT`
  (dot decimal), `EDP_BILL_NO` (our order number), optional `EDP_EMAIL`. Form host defaults to
  `https://web.idram.am/payment.aspx`; the document also shows `money.idram.am`, so set `IDRAM_FORM_URL` to the
  host Idram confirms during onboarding.
- RESULT_URL = `POST {SITE}/api/v1/payments/idram/callback`.
  - Precheck (`EDP_PRECHECK=YES`, `EDP_BILL_NO`, `EDP_REC_ACCOUNT`, `EDP_AMOUNT`): answer plain `OK` only when the
    merchant account matches, the order exists, is unpaid, unexpired and the amount equals the order total;
    otherwise `NOT OK`.
  - Confirmation: `EDP_CHECKSUM = MD5(EDP_REC_ACCOUNT:EDP_AMOUNT:SECRET_KEY:EDP_BILL_NO:EDP_PAYER_ACCOUNT:EDP_TRANS_ID:EDP_TRANS_DATE)`,
    compared case-insensitively in constant time on the values exactly as received. Event key `idram:{EDP_TRANS_ID}`.
- Env: `IDRAM_REC_ACCOUNT`, `IDRAM_SECRET_KEY`, optional `IDRAM_FORM_URL`, and `PAYMENT_MODE=live`.
- Items to confirm with Idram before launch: SUCCESS_URL/FAIL_URL configuration, the expected response body for
  the confirmation request (the sample code echoes `OK`), source IP ranges (consider allow-listing).

## ArCa (vPOS / iPay REST)

**Verification status: unconfirmed.** Hosts `ipay.arca.am` (production) and `ipaytest.arca.am` (test) and the
`/payment/rest/` base come from secondary sources (Solart.Arca.Client NuGet package documentation, the
"Planet Studio Payment Gateway for ArCa" WordPress plugin, and the `tobelyan/omnipay-arca` driver). The adapter
uses the standard iPay REST interface:
- `register.do` (`userName`, `password`, `orderNumber`, `amount` in minor units, `currency=051`, `returnUrl`,
  `description`, `language`) → `orderId`, `formUrl` (redirect).
- Return URL `GET /api/v1/payments/arca/callback?orderId=…` → server-side `getOrderStatusExtended.do`; success
  only when `orderStatus = 2` (deposited), `orderNumber` matches, `amount = total × 100` and `currency = 051`;
  `orderStatus` 3/6 → failed. Gateway errors leave state untouched.
- Env: `ARCA_API_URL` (e.g. `https://ipaytest.arca.am:8445/payment/rest`), `ARCA_USERNAME`, `ARCA_PASSWORD`, `PAYMENT_MODE=live`.

Before enabling: obtain the bank's merchant manual, confirm every field name, status code, amount unit and
whether an asynchronous notification (callback) exists. Add a server-to-server notification handler if offered.

## Mock provider (development/test)

`PAYMENT_MODE=mock` (config refuses it in production; routes return 404 in production). Checkout returns a redirect
to `/api/v1/payments/mock/checkout/{paymentId}` with Pay / Decline / Pending buttons. Automated tests post signed
events to `/api/v1/payments/mock/callback` (`X-Mock-Signature = base64url(HMAC-SHA256(MOCK_PAYMENT_SECRET, rawBody))`)
to simulate success, failure, pending, duplicates, wrong amount, invalid signature and delayed (post-expiry) callbacks.

## Test coverage

`tests/server/cart-checkout.test.ts` and `tests/server/concurrency.test.ts` cover: valid callback, missing/invalid
signature, altered amount, wrong currency, wrong order, duplicate and concurrent callbacks, failure then expiry,
late success with and without stock, payment after cancellation, the simulated provider page, forged success
redirect, cross-session status access and refund-twice protection (`admin.test.ts`). Unit tests verify the Idram
checksum and amount parsing. Live Idram/ArCa tests were **not** run (no credentials).
