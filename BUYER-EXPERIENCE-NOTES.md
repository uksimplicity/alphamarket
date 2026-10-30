# Buyer experience follow-up

Updated 2026-10-29.

## Seller chat — waiting for the backend API

The user asked for working seller chat, then confirmed **“I will provide API, note it somewhere.”** Neither `/swagger/doc.json` nor `/admin-docs/doc.json` currently documents conversations or messages. The previous product page showed a simulated exchange and discarded submitted messages; it must not be presented as a real conversation.

Keep a clear messaging entry point and an honest unavailable state until the API is supplied. Do not send messages to guessed endpoints or use placeholder phone numbers. Integration needs:

- Authenticated conversation create/list/get endpoints and real seller/user IDs on products.
- Message send/history endpoints, pagination, error responses and attachment support if any.
- Delivery/read states and real-time transport or polling guidance.
- Seller inbox endpoints/access so the seller can receive and reply to buyer messages.

The pending API applies to both buyer and seller chat. No messaging service, WhatsApp fallback, or backend storage was authorized as a replacement.

## Catalog and buyer data

The public product endpoint is `/api/v1/products/public?limit=...&offset=...&search=...`. It currently returns `data.products`, `total`, `limit` and `offset`; a read on 2026-10-29 returned an empty collection. Existing static catalog items are collection previews, not authenticated live seller records. Keep their placeholder seller contacts and product claims out of purchase flows.

Buyer order activity comes from `/user/orders`; counts describe the recent order response rather than lifetime totals. Saved products are stored on this device separately for each signed-in user, with a separate guest collection; they do not claim backend synchronization. Payment and escrow semantics remain as recorded in `ESCROW-NOTES.md`.

## Collection photo sources

The existing Unsplash collection photos are cached locally for predictable loading:

- `public/buyer/buyer-style.jpg`: https://images.unsplash.com/photo-1542291026-7eec264c27ff
- `public/buyer/buyer-tech.jpg`: https://images.unsplash.com/photo-1505740420928-5e560c06d30e
- `public/buyer/buyer-home.jpg`: https://images.unsplash.com/photo-1505691938895-1758d7feb511

The buyer overview and public product lookup currently cover the first 100 public listings. A documented public product-detail endpoint would allow direct lookup outside this initial collection without using seller-only APIs.
