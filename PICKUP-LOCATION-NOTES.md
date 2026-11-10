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
