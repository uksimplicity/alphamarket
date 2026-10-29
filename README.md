This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Paystack checkout

Pending escrow follow-up and current verification limits are recorded in [ESCROW-NOTES.md](ESCROW-NOTES.md).

Set `NEXT_PUBLIC_API_BASE_URL` to the deployed marketplace API (including `/api/v1`). Paystack secret keys and webhook configuration belong on the backend; this frontend does not need a Paystack secret key.

The integration follows the deployed [Swagger contract](https://marketplace.archintell.com/swagger/index.html):

1. A signed-in buyer supplies a delivery address and location and accepts the escrow terms.
2. Checkout posts product IDs and quantities to `/buyer/orders` with `payment_method: "gateway"`. The backend determines the amount.
3. It posts `buyer_id`, `order_ids`, and `callback_url` to `/payments/initialize`, then redirects to the returned Paystack `checkout_url`.
4. The return page at `/dashboard/checkout/payment` sends the reference to the backend's `/payments/callback` and polls `/user/orders/{id}`. Only `payment_status: "paid"` confirms success. A redirect or reference alone never confirms payment.
5. Saved order IDs allow payment initialization to be retried without recreating orders. After an uncertain order submission, check My Orders and use **Pay with Paystack** on the existing pending order. The original cart is cleared only after every saved order is confirmed paid and the cart has not changed.

The callback URL must be reachable by the customer's browser and accepted by the backend configuration. The backend must retain its Paystack webhook and verification setup. Seller bank accounts and withdrawals are connected in the `/vendor/payments` workspace.

Order creation and payment initialization forward authentication to the documented `/api/v1` endpoints once, with a 20-second timeout. They do not follow redirects or try alternative URLs after a failure. After an uncertain response, review the existing order before submitting again. Delivery confirmation and admin escrow actions use their separate documented endpoints; payment success alone does not establish that funds have been released.

Run `npm run test:payments` for the focused payment tests and `npm run build` for the production build. Before release, use a buyer account and the backend's Paystack test mode to exercise successful payment, cancellation, delayed confirmation, and resuming a pending order.

## Seller workspace

The `/vendor` workspace includes responsive navigation, product search, paid-sales reporting for 7/30/90 days, CSV order exports, fulfillment filters, and inventory alerts. Data comes from the seller product and order APIs; the overview labels its limit of 200 records per resource. Unknown stock and payment values are kept distinct from zero.

Paid sales represent confirmed customer payments, not released escrow or withdrawable funds. Admin escrow queues, release/reversal confirmations, and customer receipt confirmation are connected to the documented APIs. Order details show escrow status only when reported by the backend. Seller payouts use the dedicated payout summary, bank and withdrawal APIs; verification of backend accounting rules remains pending as recorded in [ESCROW-NOTES.md](ESCROW-NOTES.md).

Run `npm run test:seller` for the reporting checks. `tests/seller-dashboard.browser.cjs` provides local Chrome checks using synthetic data, with Next.js on port 3011 and a dedicated Chrome debugging session on port 9228. Synthetic data is used only by the test script and is never sent to the backend.

## Escrow management

Escrow applies across all user categories. Admin queues retain every category returned by the backend, while release/reversal controls remain restricted to admin accounts and backend authorization. See the [admin API reference](https://marketplace.archintell.com/admin-docs/index.html#/) and [integration notes](ESCROW-NOTES.md) for contract details and verification limits.

Run `npm run test:escrow` for the contract and proxy tests. `tests/escrow.browser.cjs` exercises the admin and order screens with synthetic records using the same local preview ports as the seller browser checks. These tests do not move real funds.

## Seller payouts

Open **Payments & payouts** in the seller menu (`/vendor/payments`). The frontend uses the configured marketplace `/api/v1` base with the signed-in account's token:

- `GET /payouts/banks` and `GET /payouts/resolve?account_number=...&bank_code=...` populate bank selection and verify the account holder before saving.
- `GET /payouts/account` and `PUT /payouts/account` read/save the payout destination. The update sends only `bank_code` and `account_number`; the backend verifies ownership and the bank result.
- `GET /payouts/summary` supplies the available balance and pending withdrawals. Paid sales, total wallet balance and held escrow are never substituted for an explicit withdrawable balance.
- `GET /payouts/withdrawals?limit=20&offset=...`, `GET /payouts/withdrawals/{id}`, `POST /payouts/withdrawals` and `POST /payouts/withdrawals/{id}/cancel` support paginated history, details, new requests and pending cancellation. Request amounts are in naira, with no kobo conversion.

Bank updates, withdrawals and cancellations require review dialogs, forward once without redirects/fallback URLs, and reload authoritative data after acceptance. An uncertain financial response blocks more actions in that tab (including after reload) until the seller explicitly refreshes account, balance and history. The backend remains responsible for authorization, current balance enforcement, concurrency, approval and avoiding duplicate transfers. No financial request is automatically replayed.

The documented response schemas are generic. Missing amount/status fields remain unknown, unrecognized lists show errors, and withdrawals stay disabled without an explicit available balance. Authenticated response shapes and real fund movement still need a controlled Paystack/backend test; no funds were moved during implementation.

Run `npm run test:payouts` for payout contract/proxy checks. `tests/payouts.browser.cjs` tests the seller flow using synthetic data with Next.js on port 3011 and Chrome CDP on port 9228.
## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
