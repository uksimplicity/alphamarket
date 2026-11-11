# Seller account location forwarding — 11 November 2026

At the user's direction, seller product creation now reads the current seller's
saved account address through authenticated `GET /user/profile`, then sends its
explicit location ID as `locationId` to `POST /seller/product`. This supersedes
the earlier conclusion that an empty public location list blocks every possible
fix: an existing seller may already have a supported-location ID saved.

The server reads with the product request's bearer token and no cache. It accepts
explicit camel/snake-case location IDs on the profile or its nested address, and
`location.id` objects. It never substitutes a user ID, address record ID, city
name, or product-form-supplied ID. The typed city remains `location`; the form's
existing coordinate forwarding remains in place. No public city lookup or new
location-selection UI is needed.

Profile failures and accounts without a returned location ID block the write
with a specific address error. Registration currently collects no address in the
web form, and the documented profile-update request has no location-ID field;
therefore a missing ID cannot be repaired merely by resubmitting city text. The
backend must expose the saved ID in its authenticated profile response for this
path to work. The live profile response has no detailed Swagger schema, so actual
account data still needs verification; no authenticated products were created.

Validation: 27 focused product tests pass, covering nested saved addresses,
overriding stale submitted IDs, missing account location, profile read failures,
one product write without replay, and existing form behavior. Focused lint and
TypeScript pass after refreshing generated route types and removing an obsolete
generated type file for the previously deleted product-locations route.

---

# Live location rejection investigation — 11 November 2026

The user still receives `location is required` after the coordinate restoration.
A fresh read of the deployed Swagger `dto.CreateProductRequest` now includes
`locationId`, described as the supported location/region ID and explicitly
"required" in its description (although omitted from the schema's required
array). `location` remains a separate string. The current form and seller proxy
send the typed city as `location`; they do not send `locationId`. Coordinates
cannot supply the missing supported-location ID.

Read-only live checks against the configured API base,
https://marketplace.archintell.com/api/v1, returned `success: true`, `data: []`
and `meta.total: 0` for all of these documented GET requests:

- `/ads/locations?limit=5&offset=0`
- `/ads/locations?search=Warri&limit=100&offset=0`
- `/ads/locations?type=city&search=Warri&limit=100&offset=0`
- `/ads/locations?type=city&search=Lagos&limit=100&offset=0`

The likely cause is the backend's required supported-location ID, rather than
missing city text. An authenticated failing POST was not replayed, so its exact
validation branch remains unconfirmed. No live products were created.

To preserve the requested single typed-city workflow, the backend must accept
nonblank `location` without `locationId`. Alternatively, the backend must first
populate active supported locations, then the frontend can resolve or select a
real ID and send it as `locationId`. Do not invent an ID, use the city name as an
ID, or select an unrelated region. No location-selection UI or lookup dependency
was added during this investigation; with an empty directory it cannot resolve
the rejection. The earlier coordinate restoration is not a verified fix.

Source: https://marketplace.archintell.com/swagger/doc.json,
`POST /seller/product`, `dto.CreateProductRequest`, `GET /ads/locations`.

---

# Restored pre-map product Location submission — 10 November 2026

The seller types a city into one Location text field; the trimmed city is sent
as `location`. There is no city-list dependency, locationId requirement, address
form, map picker or geolocation prompt in product creation.

History review found that commit fb13f24212e7f0d24ab36332e95abae1d7dca822 replaced
the automatic submission of authenticated seller coordinates with a manually
selected map point. Removing the map later also omitted those previously sent
coordinates. The earlier behavior from commit
4a1eea3e2b9428235903597ed05cc51b286a324b is restored: finite latitude/longitude
are read from the signed-in user (latitude/longitude or lat/lng, including nested
profile fields) and forwarded when present. Missing values stay omitted. No new
coordinates are invented, no address is sent, and the backend endpoint remains
POST /api/v1/seller/product.

The user's failing request includes `location: "Warri"` but no coordinates.
This confirms the city text is present and matches the identified regression
in coordinate forwarding. It does not prove coordinates cause the backend's
specific rejection. The earlier conclusion that a backend change was necessary
was premature; authenticated live acceptance still needs verification.

Validation: 24 focused product tests and 8 synthetic Chrome checks pass,
including restored seller coordinate aliases, missing/invalid saved values,
trimmed typed city and absence of address/map UI. No live products were created.

# Product Location text field — 10 November 2026

The seller types their city directly into one Location text field. The form
trims this text and submits it as `location` to the existing product-create
endpoint. No supported-city lookup, dropdown, locationId, address or coordinates
are collected or required by product creation. The city-list helper, proxy and
frontend locationId requirement have been removed at the user's request.

The seller proxy checks for a nonblank location and forwards it unchanged to
POST /api/v1/seller/product. Authenticated backend product creation still needs
the user's live test; synthetic responses establish the outgoing request, not
whether the backend accepts city text without a locationId. If it rejects this
request, the backend must support the requested typed-city workflow.

Validation: 22 focused tests and 8 synthetic Chrome checks passed. These cover
a typed city, trimming, no city-list dependency, omission of address/coordinates,
blank-city rejection and forwarding without an ID. No live products were created.

---

# Create-product API review — 4 November 2026

Source: fresh, uncached read of https://marketplace.archintell.com/swagger/doc.json,
`POST /seller/product`, `dto.CreateProductRequest`.

The schema lists six required fields: `basePrice`, `categoryId`, `name`,
`productTypeId`, `sellerId`, and `slug`. The reported iPhone request includes all six.

Brand handling:

- A selected brand sends `brandId`, with no `brandName`.
- With no selected brand, a typed name sends trimmed `brandName`, with no `brandId`.
- With neither supplied, both fields are omitted. The backend identifies the brand
  from the product name automatically. Omission does not mean the backend will
  necessarily save a NULL brand; this corrects the earlier frontend investigation.
- The documented maximum brand-name length is 150 characters.

The other documented fields are optional: `address`, `attributes`, `discounts`,
`latitude`, `location`, `longitude`, `media`, `shortDescription`, `stock`, and `tags`.
The current form collects these except separate `address` and `attributes`.
Omitting unused optional fields does not make the request incomplete.

Nested structures:

- `media`: `cover` (string), `images` (string array), `video` (string).
- `attributes`: objects with required `attribute_id` and `attribute_value_id`.
- `discounts`: objects with `active`, `title`, `price`, `startDate`, and `endDate`.
- `tags`: array of tag names.

The existing form also sends `status` and `isPublished` for its publish/draft
workflow. These fields are absent from the refreshed create schema; their backend
support needs confirmation before draft persistence can be assumed. This brand
change preserves that existing workflow.

Regression checks cover selected-brand precedence, typed names, omission of both
fields, the name-length limit, required payload fields, and proxy forwarding.
These use synthetic responses and do not verify live product creation.
