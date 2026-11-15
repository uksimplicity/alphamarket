# Seller pickup coordinates

The reported checkout error says the backend resolved pickup to (0, 0), outside
Nigeria. This is the seller/sender pickup, not the buyer's selected dropoff.
The web seller profile previously saved address text without latitude/longitude.
The documented UpdateProfileRequest accepts both fields. Product creation also
accepts coordinates, but the documented product update request does not expose
a location/coordinate update contract.

The seller profile Address Book editor now uses the shared structured Nigerian
address lookup and map/GPS picker. Address edits clear the old coordinates.
Zero/missing points cannot be saved. The profile client sends latitude/longitude
with the address and reads coordinates from the backend, never browser cache.
The editor reads the saved profile back before confirming the location persisted.
An uncertain PUT is forwarded once, without fallback replay.

After deployment, each affected seller must open /vendor/profile, edit the
primary address, select their actual pickup location, and save. No real seller's
location was changed by implementation/testing. The buyer can then retry review
of the existing cart. Do not substitute the buyer's coordinates for pickup.

Backend responsibility remains: select a valid saved pickup source for each
seller/product, persist coordinates, and validate service-area membership. If
checkout still reports zero after a verified profile update, inspect the product
pickup snapshot/source and provide a documented coordinate update/migration path.
The website cannot prove that existing product records were repaired by updating
the seller profile alone.

Verification commands:

    node --test tests/profile-location.test.cjs tests/structured-address.test.cjs tests/geocode-address.test.cjs
    node tests/seller-profile-location.browser.cjs

Production build and TypeScript passed. All 20 focused profile/location/session
checks and all 8 seller-profile browser checks passed, including incomplete
dropdown rejection, read-only full address, backend coordinate read-back,
reopening saved fields, coordinate clearing and mobile width.
Tests use synthetic identities and API responses, not live seller writes.

## Confirmed live contract gap

The user supplied the actual seller profile GET response after attempting save.
It reports success, but data includes only id, email, phone, first_name,
last_name, role, status, verification flags and created_at. It omits address,
city, state, country, postal_code, latitude and longitude entirely. The supplied
PUT request contains nonzero numeric latitude/longitude and the generated full
address. No account identifiers, contact details or actual coordinates are
retained here.

This proves the frontend cannot verify coordinate persistence through that GET.
It does NOT prove the PUT failed to persist them. Do not hide the verification
failure or substitute the browser-selected point as proof of saved backend data.
The separate checkout error establishes that the order service currently
resolves its pickup to zero; its actual source must be traced on the backend.

Backend follow-up:

1. Check PUT /api/v1/user/profile binds and persists latitude/longitude plus the
   address fields on the authenticated seller record; ensure zero/missing values
   are not substituted for supplied values.
2. GET /api/v1/user/profile must return those persisted fields in data. Check
   its query, response DTO/serialization and whether it returns an abbreviated
   authentication record rather than the saved full profile.
3. During order creation, trace each product's pickup source. Use the intended
   valid product pickup or the documented seller-profile source. Do not silently
   fall back to (0, 0), and do not use the buyer's dropoff as pickup.
4. For existing product snapshots with zero pickup coordinates, provide a
   documented repair/migration path or defined profile fallback policy.
5. Rehearse with an authenticated seller: PUT a known valid point, GET and
   compare the persisted values, then review an order with a separate buyer.

Expected GET data must retain existing fields and add at least numeric latitude
and longitude plus address/city/state/country/postal_code. A successful PUT
response alone is insufficient to validate the source used by order creation.

## Buyer checkout follow-up - 15 November 2026

The same pickup-zero error was reported for Football. A fresh public product
read returned its ID/name/location but omitted address and latitude/longitude;
that omission does not establish whether the backend stored coordinates.
The current CreateOrderRequest still accepts buyer dropoff coordinates only.
The product update DTO accepts address but has no latitude/longitude repair
fields. No supported pickup-repair endpoint was found in the public schema.

Buyer checkout now translates the explicit pickup-location validation error to
a seller-facing-action message, preserves cart and current delivery-address
inputs, and links to product details and Edit cart. Unrelated dropoff, payment,
and validation errors retain their original messages. The backend response is
not rewritten, so Network diagnostics remain available. Existing safeguards
against replaying uncertain order/payment requests remain intact.

The underlying pickup resolution has NOT been repaired. No real product,
profile, order or payment was changed. The user was asked for the backend
repository/path so product geocoding persistence and order pickup selection
can be corrected there. Do not claim that the buyer guidance makes this item
orderable. These frontend changes are local and not published.

Verification: 28 checkout-error/payment/pricing checks passed; focused lint has
no errors and one existing cart-thumbnail optimization warning.

## Confirmed product pickup point - 15 November 2026

The user approved frontend geocoding as an interim solution. Both seller product
and buyer/seller ad creation now locate the composed full address using the
existing Google browser geocoder. A single precise building result is proposed;
the user must explicitly confirm it or choose and confirm a map/GPS point.
Lookup failures provide a retry and map/GPS fallback without inventing a point.
Google Maps/Geocoding must be enabled for the configured browser key; GPS is
available only when the user is physically at the pickup address.

The creation request includes numeric latitude/longitude alongside address and
locationId. Existing account coordinates and region centres are not substituted.
Address or supported-region edits discard confirmation. Lookup cleanup ignores
late results after edits/unmount; submission blocks missing, zero, invalid and
stale-address coordinates before uploads or writes. Existing media-save and
uncertain-write safeguards are retained. Admin creation is unchanged.

Read-only live checks found the affected Football ad address is "Ogba" and its
selected Ikeja location record has latitude/longitude zero. Ad documentation
specifies region-centre fallback when no exact point is supplied. The public and
seller product responses omit product coordinates, so neither geocoding
persistence nor the actual order pickup source has been established.

These changes apply to new submissions, not existing products. Backend acceptance,
persistence and checkout use of supplied coordinates still require live
verification. No real listing/profile/order/payment was changed. Publication
scope is the product/ad pickup form and its tests. The buyer checkout guidance
described in the previous section remains local and is not part of this push.

Validation: 70 focused creation/geocoder/proxy checks passed, including explicit
confirmation, lookup failure with map fallback, stale-address callbacks, invalid
points, account switches and supplied-coordinate forwarding. The four pickup
component checks were rerun after safe account initialization. TypeScript,
focused lint and the production build passed. Google results and account data
in tests were synthetic; live backend coordinate persistence was not tested.
