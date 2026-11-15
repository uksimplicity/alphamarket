# Notifications - 15 November 2026

Buyer `/dashboard/notifications` and seller `/vendor/notifications` now display
the authenticated notification inbox. The existing browser-only preferences
remain available in a collapsed preferences section.

The local `/api/user/notifications/[[...path]]` proxy uses the five documented
backend endpoints under `/api/v1/user/notifications`: list (GET), unread-count
(GET), read-all (POST), one notification (DELETE), and one notification/read
(PATCH). It forwards bearer authorization, allowlists pagination/read/type
filters, disables caching, rejects redirects, and never replays writes. The
backend remains responsible for ownership checks.

The inbox supports All/Unread, page navigation, grouped event counts, mark read,
mark all read, delete, refresh, loading/error/empty states, and known internal
destinations for order/ad/product/chat data. It does not follow arbitrary URLs
from notification payloads. Mutations refresh the list and bell count rather
than assuming success or optimistically hiding records.

Buyer marketplace and seller workspace bells display the backend unread count
(99+ visually above 99). Counts refresh every minute while visible, on window
focus/visibility changes, and after inbox mutations. No browser push permission
or new FCM subscription was added. Account identity/generation checks and request
cancellation prevent earlier sessions' results appearing in another account.

API contracts were checked against the live public Swagger. Verification uses
synthetic data; no live notifications were read, marked, or deleted. Authenticated
production acceptance and publication remain outstanding.

Verification: 16 notification/session tests, TypeScript and the production build
passed. Focused lint has no errors and two existing logo-image warnings.
Run `npm run test:notifications` for the notification-specific regression checks.
