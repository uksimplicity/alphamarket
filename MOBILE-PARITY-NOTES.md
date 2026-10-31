# Web and mobile parity - 31 October 2026

The user requested all recent Marketplace_APP work in the web marketplace,
including the shared chat service. Existing payment, escrow and payout behavior
has been retained and checked with synthetic browser fixtures.

| Area | Implemented web behavior |
| --- | --- |
| Catalogue | Server search, pagination beyond 100 listings, retry without duplicate rows, stale-query protection and public product ID lookup. Collection previews remain labelled and cannot be purchased. |
| Sessions | Backend profile verification before buyer/seller workspaces, server role checks, expiry/resume checks, current-session 401 handling and stale-account response guards. No local seller approval. |
| Account separation | Cart, saved products, saved addresses, notification choices, review drafts and payment recovery markers are scoped by account. Matching legacy checkout markers migrate safely. Guest collections remain separate. |
| Saved addresses | Add/edit/delete/default, browser persistence, explicit checkout selection and storage error/reset handling. Defaults are not silently applied to orders. |
| Delivery location | Reviewed GPS, optional draggable Google map pin, manual coordinates, explicit confirmation, cancellation and late-result/account guards. Opening the picker does not request GPS. |
| Notifications | Buyer/seller choices persist on this browser per account. Developer setup warnings stay out of the app. Settings do not imply push delivery or server subscriptions. |
| Reviews | Delivered/confirmed orders retain unpublished text/rating drafts per account/order. No simulated publication or invented public ratings. |
| Chat | Buyer/seller inboxes share the mobile presentation service through a same-origin proxy. Registered seller directory, history, visibility-aware polling and stable send IDs. Failed sends preserve drafts. Only server-confirmed messages enter history. Product links use a real seller ID; otherwise the buyer chooses a seller. |
| Seller products | Documented list/create/update/delete, attributes, reference and upload paths; authenticated writes once without redirect/fallback replay or mock success. Brand choice enabled and preserved. Editor uses real reference choices and preserves gallery/video when replacing the cover. Mobile overflow fixed. |
| Payments, delivery and payouts | Existing authoritative payment/order/escrow/withdrawal integrations retained. Synthetic tests do not move funds, confirm real deliveries or activate sellers. |

## Configuration and presentation operation

- Keep `NEXT_PUBLIC_API_BASE_URL` configured with the marketplace API.
- `CHAT_SERVER_URL` is server-only. Local `.env.local` points to the same current
  HTTPS tunnel as the Android presentation APK. Browsers call `/api/chat/*`.
- The shared server, stored messages and start/stop scripts remain in
  `Marketplace_APP/presentation-chat`. The computer and tunnel must stay online.
  Restarting a Quick Tunnel may change its URL: update the web environment and
  rebuild the APK if that happens. The seller opens Messages first to register
  in the presentation directory.
- Set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` before building to activate the optional
  map. Restrict it to intended website domains and enable Maps JavaScript API.
  GPS/manual selection works without a key. GPS requires a secure origin (or
  localhost) and location permission.
- Developer setup notes belong here rather than in customer screens.
- `npm run dev` and `npm run build` explicitly use Webpack. Turbopack failed to
  resolve Next.js while writing the catch-all auth route in this environment;
  Webpack serves and tests the same application routes successfully.

## Verification

- All 66 Node unit/API tests pass: catalogue, auth/account isolation, persistence,
  map loading/retry, chat, seller writes/uploads, payments, escrow, payouts,
  seller reporting and rider identity.
- All 108 browser checks pass: buyer 28, seller dashboard 13, payouts 25,
  escrow 16, addresses/location/notifications/drafts/chat/session 21, seller
  editing/creation 5. Includes mobile widths and preserving existing media.
- TypeScript and changed-feature lint checks pass. Broader UI lint still has
  existing image and unused-import warnings; no globally warning-free claim.
- Browser checks use synthetic identities and application API fixtures.
  They do not exercise live financial actions or real cross-device delivery.
- `npm run build` passed using Next.js 16.1.6/Webpack; all 72 static pages
  generated and dynamic chat/auth/product routes compiled successfully.
- Rechecked the 21 new-feature and 5 seller product browser cases against the
  compiled production build; all 26 passed. Local production preview is available
  at `http://127.0.0.1:3011` while its process remains running. Shared public
  presentation chat health returned `{"status":"ok"}` after the build.

## Still required

1. Authenticated rehearsal with real buyer/seller accounts, including web-to-phone
   chat across different networks and customer -> driver -> completion. The
   presentation chat service is temporary, not production hosting.
2. Google Maps API key activation and actual device/map permission testing.
3. Firebase project/configuration, push delivery and notification history APIs.
4. Backend contracts for published reviews, address synchronization, support and
   production chat. Browser-local data does not synchronize to the mobile app.
5. Controlled backend/Paystack tests for payment recovery, escrow accounting and
   payouts. Backend ownership, authorization and balance enforcement are required.
6. Production seller activation and a documented automatic refresh contract.
7. Deployment of this website with its environment configuration. A local build
   does not update the hosted website automatically.

The web retains its existing browser auth storage. It does not claim native
secure-storage equivalence; server-managed HttpOnly sessions require a coordinated
web authentication change. No missing credentials or backend contracts were invented.
