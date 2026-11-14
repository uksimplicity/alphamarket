# Marketplace Ads — 14 November 2026

Implementation follows the live public and admin Swagger documents:

- https://marketplace.archintell.com/swagger/doc.json
- https://marketplace.archintell.com/admin-docs/doc.json

Products remain in the seller workspace. My Ads is a separate view of the same
product/ad records, using the backend's ownership and moderation APIs.

## Screens

- Public browsing and detail: `/ads`, `/ads/[id]`.
- Buyers: `/dashboard/my-ads`, `/dashboard/my-ads/create`,
  `/dashboard/my-ads/[id]`, `/dashboard/wallet`.
- Sellers: `/vendor/my-ads`, `/vendor/my-ads/create`,
  `/vendor/my-ads/[id]`, `/vendor/wallet`.
- Admin moderation and details: `/admin/ads`, `/admin/ads/[id]`.
- Admin posting fees and audit: `/admin/ads/fees`, `/admin/ads/history`.
- Promotion plans and purchases: `/admin/promotion-plans`,
  `/admin/ad-promotions`.
- Existing admin location management remains at `/admin/locations`.

## Posting and moderation

Seller Products still posts through `POST /seller/product`. My Ads posts through
`POST /user/ads` for buyers and sellers. The shared posting form preserves media
previews, individual removal, upload reuse, structured address entry, and the
separate selected location ID. My Ads creation sends the documented ad fields,
without seller identity or publication flags. Its address is geocoded by the
backend, as confirmed by the user.

The backend quotes the applicable inherited/default/category fee. Forms display
the quote and wallet balance and recheck both before uploading media or posting.
The backend remains authoritative for atomic wallet charging. Successful
submissions say pending review, rather than claiming immediate publication.
Seller/My Ads forms do not offer undocumented server-side drafts. The existing
admin product form is preserved.

Own-ad edits, deletion, history, rejected/changes-requested resubmission, available
promotion plans, promotion purchases, and purchase history use `/user/ads`.
Resubmission of a rejected ad rechecks the posting fee because rejection refunded
it. Content edits to approved ads return to review according to the backend.
Promotion purchases are available only for approved, published ads. Prices and
wallet balance are rechecked before buying a plan.

Admin moderation supports approve, reject, request changes, temporary/permanent
suspension, unsuspension, logged edits, reason-bearing deletion, and audit history.
Posting-fee overrides and promotion-plan targeting use the documented fields.
Promotion cancellation includes an explicit unused-share refund choice.

Dedicated allowlisted proxies call exactly one documented backend route, forward
bearer authorization only for protected requests, and do not replay mutations or
follow redirects. Admin DELETE reasons are preserved. Unknown write outcomes
block repeat submission until the record and wallet are refreshed. Backend
authorization continues to enforce ownership and admin permissions.

## Wallet funding dependency

The published schema exposes wallet balance/transactions and an order-payment
initializer that requires `buyer_id` and nonempty `order_ids`. It does not expose
a wallet top-up initializer. The user confirmed Paystack is the payment provider;
this alone does not establish the wallet-funding request contract.

Fund Wallet leads to the wallet page, where top-up is explicitly unavailable
until the backend supplies its Paystack wallet-funding initializer and verified
credit flow. No payment is initialized using fake order IDs, and no Paystack
secret is put in frontend code.

## Verification boundaries

Public Ads responses were read from the live backend. Existing local QA account
logins were unavailable, so protected response handling and business mutations
are tested with synthetic data. No live ads, fees, promotion plans, wallet
debits, refunds, or moderation decisions were created during implementation.
