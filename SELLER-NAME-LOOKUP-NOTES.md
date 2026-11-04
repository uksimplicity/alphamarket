# Seller-name lookup trial — 4 November 2026

Buyer cards and product details can resolve a missing seller name by matching the
product's seller ID against `GET /api/chat/sellers`. The existing chat proxy reads
the Messages service's `/v1/sellers` directory using the buyer's own token.

The directory uses account IDs and names verified from the marketplace profile
service. Names already present in a product response take precedence. Unknown IDs
keep the existing fallback. No seller names are hardcoded.

Requests are shared for five minutes within the same buyer session. Responses
from a previous account cannot populate the current account's display. Preview
items, guests, and products with an existing seller name do not start a lookup.
Browsing does not create a Messages session, conversation, or message.

This is a limited lookup source. The current Messages service lists only sellers
registered there, and requires the buyer to have connected through Messages.
The directory can also be unavailable when its presentation server is offline or
not configured in hosting. In those cases shopping remains available and the
fallback label remains. A marketplace seller-by-ID endpoint or seller names in
the public product response are still needed for complete account coverage.

Verification uses synthetic data: exact ID matching, existing-name precedence,
unknown IDs, shared requests, account switching, and directory failures. It does
not prove that a particular live seller is registered in the directory.
