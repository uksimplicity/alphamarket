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
