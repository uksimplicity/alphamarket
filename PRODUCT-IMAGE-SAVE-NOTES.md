# Seller product image saving - 15 November 2026

At the user's direction, following clarification from their backend developer,
seller product creation now saves media through the product update endpoint.

The form still uploads each file through `POST /upload/file` and retains the
returned URL unchanged. The local seller product proxy validates the submitted
product and location, then calls `POST /seller/product` without media. After a
successful creation response provides the product ID, it calls
`PUT /seller/product/{id}` with `product_id`, `seller_id`, and the submitted
`media` (cover, gallery URLs and video). All backend paths use `/api/v1`.

Both writes retain the seller's bearer authorization. Neither write is replayed
or followed through redirects. Success is returned only after the media update
succeeds. A failed or uncertain media update reports that the product already
exists, provides a link when its ID is available, and blocks another creation
from that form. Missing creation IDs do not trigger a guessed update.

This change is limited to Seller Products; the separate My Ads and admin flows
are unchanged. Existing live products have not been updated. Live acceptance
and deployment remain to be checked; synthetic tests cannot establish whether
the backend will make a saved image publicly viewable.
