# Product city update — 10 November 2026

The current CreateProductRequest documents `locationId` as the required supported
location/region, in addition to the legacy `location` text field. The product
form now loads active cities from `GET /api/v1/ads/locations?type=city`, including
pagination, and lets the seller select a real city. Creation sends its ID as
`locationId` and city name as `location`. The structured full pickup address is
sent separately as `address`; the confirmed pickup latitude/longitude remain
unchanged. Missing/unavailable selections are caught before image uploads or a
product write. Refresh cities retries the read while retaining form contents.

Live dependency: on 10 November, the public locations endpoint returned
`data: []` and `meta.total: 0` for both all locations and cities. An administrator
must register/activate supported cities using the documented authenticated
`POST /api/v1/admin/ad-locations` endpoint (e.g. name `Lagos`, type `city`,
is_active `true`, with the appropriate parent if a hierarchy is configured).
The frontend cannot substitute a state/LGA label or made-up ID for a supported
location record. No live locations or products were created during this fix.

Checks use synthetic responses for city selection, payload separation,
missing/unavailable cities, public city proxy behavior and seller submission.

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
