# Current pricing rule - 10 November 2026

This section supersedes the older pricing and delivery-inference rules below.

- Buyer total = seller product subtotal + admin commission + delivery fee.
- Commission uses the order's recorded amount, or its recorded percentage applied to the product subtotal, excluding delivery.
- Seller proceeds = full seller product subtotal; commission is charged to the buyer.
- Sellers and admins see commission separately. Buyers see only the amount with commission included, a delivery fee when delivery applies, and the total. Buyer pricing errors do not expose the commission breakdown.
- RequiresDelivery=false excludes delivery from the buyer charge and hides the delivery row. RequiresDelivery=true includes the returned fee. The current checkout has no separate delivery checkbox; this follows the backend selection flag.
- A missing delivery fee can be inferred only when both product subtotal and commission are known. Unknown commission must not be labelled as delivery.
- Historical saved totals remain authoritative and conflicting amounts are flagged. The current global commission setting is never used to reprice saved orders.

The order and payment proxies still send product IDs/quantities and saved order IDs respectively. Actual charging, escrow and payouts are performed by the external backend.

Confirmed Create Order contract: Commission is the admin amount; TotalAmount includes seller price plus commission and excludes DeliveryFee. Buyer total is TotalAmount + DeliveryFee; seller price is TotalAmount - Commission. For the supplied example, 9450 + 1451.64 = 10901.64 paid by the buyer, with 9000 seller proceeds and 450 commission. Delivery is added once. Missing DeliveryFee remains unknown rather than becoming zero. Explicit buyer_total and legacy total_amount fields retain their all-in semantics.

Checkout preserves the Create Order rows with its saved order IDs. Authenticated order-detail refreshes take priority; fields omitted by the later GET can fall back to the matching creation row for the same buyer and order. Errors still block review rather than silently accepting stale pricing. The public Swagger 201 response uses a generic response.APIResponse; the capitalized money-field semantics above were confirmed by the user from a real response.

Review verification (10 November 2026): 60 focused pricing, payment, commission-setting, seller-data, buyer, escrow and payout tests passed. All 18 Chrome browser checks passed against the local preview, including the exact supplied Create Order amounts, delivery disabled, hidden commission, refresh recovery, duplicate prevention, mobile, buyer details, seller proceeds and admin breakdowns. TypeScript and focused lint passed (one existing checkout image warning). The mobile pricing screenshot was visually inspected. No live orders, payments or settings were changed. The externally hosted payment charge and settlement remain unverified.

The review also fixed refresh priority across total aliases: a newly fetched TotalAmount now takes precedence over an older saved buyer_total/total_amount. Invalid fresh totals are flagged instead of being replaced by an old total.

---
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

Requested follow-up: show delivery cost as soon as the buyer supplies a delivery
address/location, before order creation. The 2026-11-04 public and admin Swagger
contracts contain no delivery quote endpoint. This needs a backend quote contract
using product IDs/quantities and the confirmed delivery location, returning the
delivery fee and currency/units (including how multiple sellers are priced).
Do not create orders automatically when an address changes or invent a delivery
rate. The buyer-facing paragraph about backend calculation and seller commission
has been removed; saved-order fee review remains available until quoting exists.

The order and payment proxies strip client-supplied prices, delivery fees,
commission settings and payout amounts. The backend determines the charge.

## Pricing data

Update, 8 November 2026: at the user's request, when a separate delivery fee is
absent, display buyer total minus product subtotal as delivery. Recorded order
subtotals/item prices take priority. If all seller orders together omit their
subtotal/items (as in the live capitalized response), checkout uses its saved
submission cart snapshot, including quantities, and subtracts it once from the
combined saved-order total. It never uses today's catalogue or the edited cart.
Explicit backend fees, including zero, remain authoritative. Invalid amounts or
negative differences are flagged, not clamped to zero. Existing orders without
recorded item prices or a matching checkout snapshot remain unknown. This is a
display convention pending backend clarification, not verification of distance
pricing. Payment requests and the backend's charged total are unchanged.

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
