# Seller product address and selected supported location — 14 November 2026

Seller product creation now collects an admin-configured supported location ID
separately from the existing free-text `location`. The dropdown reads all pages
of `GET /ads/locations`; hierarchy labels distinguish locations with the same
name. Both preflight and submission validate the selected ID with
`GET /ads/locations/{id}`. A selected area is preserved, rather than resolving
the typed text to a different city. Older clients that omit `locationId` retain
the existing city-text resolution path.

The seller enters house number, street, state, and LGA. State/LGA choices reuse
the existing Nigerian regions data; changing state clears the LGA. These fields
are combined into the documented `address` string, for example
`12B Allen Avenue, Ikeja, Lagos, Nigeria`. They are not sent as invented API
fields. The user confirmed that the backend geocodes and saves this address.
The seller form does not send saved account coordinates with the new product
address because those coordinates may belong to a different address. Admin
product creation and existing API clients retain their previous behavior.

This change covers product address/location entry, not the separate My Ads,
posting-fee, moderation, or promotion interfaces. No live products were created.

---

# Supported product cities through the existing admin API — 11 November 2026

The user's authenticated profile contains only identity/account fields, with no
address or location ID. The previous profile-location requirement was incorrect
and has been replaced. Seller product creation resolves the trimmed typed city
through `GET /ads/locations?type=city&search=...`, checks every returned page,
and forwards the unique exact city record's real `id` as `locationId` to the
existing `POST /seller/product`. Submitted IDs are overridden; fuzzy, inactive,
non-city and ambiguous matches do not produce a product write. Account profile
reads are no longer involved. Product address and coordinates are preserved if
present in the submitted body. The seller form retains its single typed-city
field and existing optional saved-coordinate forwarding.

The separately deployed admin schema at
https://marketplace.archintell.com/admin-docs/doc.json already documents:

- `GET /admin/ad-locations` to list locations including inactive records.
- `POST /admin/ad-locations` to create a supported region.
- `PUT /admin/ad-locations/{id}` to update it, including `is_active`.

The new `/admin/locations` page (Catalog > Locations) uses these existing APIs
to add active countries/states/cities/areas and activate/deactivate records.
Parent selection supports the documented hierarchy. Writes are authenticated,
sent once without redirects/replay, and followed by a fresh read. Unknown save
results preserve the draft and require explicit refresh before another write.
The backend continues to enforce admin authorization. No backend code changes
are needed; admins must configure supported cities through these existing APIs.

Read-only live verification still found the public location directory empty.
An administrator must add/activate Warri (type `city`) before a seller can use
Warri. No live location records or products were created during implementation.
Authenticated production acceptance remains to be verified after configuration.

Validation: all 42 `npm run test:seller` checks pass, including pagination,
exact matches, failures, and avoiding duplicate writes. TypeScript and the
production build pass. Focused lint has no errors (two existing AdminShell
warnings). All five `tests/ad-locations.browser.cjs` checks pass against the
local production build: empty directory, creation, activation, unknown save
handling/draft retention, and mobile layout, with synthetic data only.

---

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
