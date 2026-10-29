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

The callback URL must be reachable by the customer's browser and accepted by the backend configuration. The backend must retain its Paystack webhook and verification setup. Seller payout/bank account screens are not part of this checkout integration.

Run `npm run test:payments` for the focused payment tests and `npm run build` for the production build. Before release, use a buyer account and the backend's Paystack test mode to exercise successful payment, cancellation, delayed confirmation, and resuming a pending order.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
