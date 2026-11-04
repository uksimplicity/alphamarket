# Product commission and order pricing

The web flow follows these rules:

- Buyer total = product subtotal + delivery fee.
- Admin commission = product subtotal × the order's commission percentage / 100.
- Seller proceeds = product subtotal − admin commission.

Product creation/editing sends the seller's selling price unchanged. Commission
is not added to that price or to the delivery fee. The existing backend remains
responsible for delivery distance/rates, order prices, commission accounting,
escrow release, wallets and payouts. No rate-per-kilometre control was added.

## Checkout

Review order creates the order once using product IDs, quantities and the
confirmed delivery address/coordinates. It stops before payment initialization.
The page then loads the saved orders through GET /user/orders/{id}, shows their
pricing, and enables Continue to Paystack only after a payable total is available
without conflicting amounts. Payment initialization sends the saved order IDs.
Failed pricing refreshes and payment attempts never recreate the order.

The order and payment proxies strip client-supplied prices, delivery fees,
commission settings and payout amounts. The backend determines the charge.

## Pricing data

The common adapter reads explicit subtotal, delivery, buyer total, commission
amount, order commission_percentage and seller proceeds fields. It supports
snake/camel aliases already used in the app. Money arithmetic uses integer kobo.
Missing values remain Not reported. Zero remains a real value.

The adapter can derive product subtotal from recorded item unit prices and
quantities, or buyer total minus a reported delivery fee. It derives commission
only from an order's explicit percentage; ambiguous commission_rate values and
the current global setting are never used to reprice historical orders.
Reported totals are checked against the product-plus-delivery rule. Seller
proceeds exclude delivery and are distinct from withdrawable payout balances.

Buyer details, seller lists/details, seller dashboard/CSV and admin order
breakdowns use these amounts. The existing payout service remains the only
source of available-to-withdraw balances.

## Location fallback

Use my location appears above the optional map and works without a Google map
key. It requires browser location permission, HTTPS/localhost, and explicit
confirmation. Use it only when physically at the delivery/pickup address.
Changing the checkout address clears the previously selected coordinates.
No default or invented delivery coordinates are supplied.

The local .env.local now contains NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. A fresh
production build includes it. The first live browser check on 2026-11-04 returned
RefererNotAllowedMapError for http://localhost:3011. After the user added the
preview origins, the live map loaded, accepted a clicked point and confirmed the
delivery location. This passed again after a five-minute propagation wait.
GPS selection and confirmation also pass with synthetic browser coordinates.
See GOOGLE-MAPS-SETUP.md for origins and remaining verification limits.
Hosted environment settings were not inspected or changed.

## Verification limits

The user-provided successful order-list response contained no orders. Live
nonempty order fields, commission_percentage consumption during order creation,
escrow allocation and actual seller/admin settlement remain unverified. The
frontend does not implement or simulate ledger credits. The backend developer
must ensure order snapshots contain the applied commission and that settlement
uses the same product-only rule and saved setting described in
COMMISSION-SETTINGS-NOTES.md.

Validation uses synthetic API responses: 46 focused map, pricing, commission,
payment, escrow, seller-data and payout tests; 16 pricing-flow browser checks.
TypeScript and focused lint pass (existing image/hook warnings remain).
No real orders, payments, delivery rates or settings were changed by QA.

Commands:

    node --test tests/google-maps.test.cjs tests/order-pricing.test.cjs tests/payments.test.cjs tests/seller-data.test.cjs tests/commission-settings.test.cjs tests/escrow.test.cjs tests/payouts.test.cjs
    node tests/pricing-flow.browser.cjs

Browser checks require the local preview on 3011 and dedicated Chrome CDP on
9228. They cover GPS without maps, stale-point clearing, review before payment,
bad/missing totals, duplicate prevention, mobile, seller proceeds and admin splits.

Continuation verification (2026-11-04): all 46 focused tests and 16 pricing-flow
browser checks passed again against a fresh production build. TypeScript and
the production build passed (72 static pages); focused lint had no errors and
one existing checkout image warning. After the user updated the Google Cloud
website restrictions, live map loading, point selection and confirmation passed
twice on localhost:3011, including after a five-minute wait. No real orders or
payments were created. Local production preview: http://127.0.0.1:3011 while running.
