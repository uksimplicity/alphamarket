# Google Maps on the marketplace website

The checkout, saved-address editor and seller product creation form share a map
picker. Users click the map, drag the pin or request their current location,
then explicitly confirm. Coordinates are kept internal. Cancel leaves the previous point unchanged.
The address book also locates a typed address when saving. It accepts a single,
specific building-level match; incomplete or ambiguous results require map confirmation.
The product form keeps the typed pickup address; its selected coordinates are sent
as `latitude` and `longitude`. Changing the address clears its old selected point.
The account profile coordinates are not substituted for a product's location.

Checkout, saved-address editing and product creation now have House number,
Street name, State and LGA fields at the top. State is a dropdown including the
FCT; LGA is a dropdown limited to the selected state. Changing state resets LGA.
The generated full address appears underneath and is read-only. Existing saved
addresses in the generated format repopulate their editable fields, allowing
case and common separator differences without inventing a state/LGA match.
Once street, LGA and state are complete, lookup runs after typing pauses for
900 ms. A single precise building match selects internal coordinates. Partial,
multiple, street-only or approximate results require map/GPS confirmation.
Changing any address field clears the previous point. Late results after edits,
manual selection, leaving the form or changing accounts cannot replace it.
Checkout sends the confirmed point as `dropoff_lat` and `dropoff_lng`; the backend
remains responsible for distance and delivery pricing. Address lookup creates no
orders and initializes no payments.

## Google Cloud configuration

Use a separate website key in the existing billed project. Keep the Android key's
Android application restrictions unchanged.

1. Enable **Maps JavaScript API** and **Geocoding API** in the same project.
2. Create an API key named `Marketplace Web`.
3. Select **Websites** under application restrictions. Add:
   - `https://alphamarket-weld.vercel.app/*`
   - `http://localhost:3000/*`
   - `http://localhost:3011/*` (current local production preview)
   - `http://127.0.0.1:3011/*` (same preview accessed by IP)
   - Any other actual production or development origins in use, including ports.
4. Restrict API access to **Maps JavaScript API** and **Geocoding API**.
5. Save and allow Google time to apply the settings.

Add to the ignored `.env.local`, preserving its other entries:

```dotenv
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_website_key
```

Set the same variable in the Vercel project's environment settings for the intended
environments and redeploy. Next.js embeds this public key at build time. It is
visible to browsers, so website and API restrictions must be configured in Google
Cloud. Do not commit actual keys or reuse the Android-restricted key.

The picker displays loading and failure feedback, and GPS stays
available if the map cannot load. GPS requires HTTPS (or localhost) and browser
permission. Opening the picker does not request location permission.
Use my location is placed above the optional map. The point can be confirmed
without a map preview, but the buyer must be physically at the delivery address.
Editing the checkout address clears an old selected point to prevent an incorrect
distance calculation. The backend's existing delivery rate is unchanged.

Verify on the configured origin: map click, marker drag, GPS, confirm, cancel and
product submission. Local tests use synthetic coordinates and never change live
accounts or create real orders/products.

Reference: https://developers.google.com/maps/documentation/javascript/get-api-key

## Latest verification: 2026-11-04

The local website key is present and a fresh production build succeeds. A real
Google Maps browser request from `http://localhost:3011` initially returned
`RefererNotAllowedMapError`. The user added the preview origins and the live map
check then passed twice, including after a five-minute propagation wait: loading,
clicking a point and confirming the delivery location all succeeded.

For future origin changes, in Google Cloud Console open **APIs & Services >
Credentials > Marketplace Web** (or the website key actually configured locally)
and add the two port-3011 website restrictions above. Save and allow the change
to propagate. If only restrictions change, the existing build can be reused;
changing the key value requires rebuilding. No key value is recorded here.

With the local preview on port 3011 and isolated Chrome CDP on port 9228, rerun:

```powershell
node tests/google-maps-live.browser.cjs
```

This check uses a synthetic buyer, loads the real Google map, clicks a location,
confirms it and asks the real Geocoding API to locate a public Lagos street
address. Application API calls are intercepted; it creates no orders,
makes no payments and does not request device GPS. Use `MAPS_SMOKE_ORIGIN` to
check another localhost or 127.0.0.1 preview origin. A pass does not establish
that real-device GPS, pin dragging or the hosted website work.

Structured-address verification: TypeScript and the production build passed,
along with 30 focused unit/API tests, 10 new address browser checks, 16 pricing
browser checks, 29 saved-address/chat/account browser checks and seller product
checks including map click, drag, cancel and GPS. Synthetic tests verify lookup
debouncing, address composition, stale/account-change rejection, ambiguity,
service failure/retry, mobile width and the geocoded order payload.

Live geocoding initially returned `REQUEST_DENIED`. After the user enabled
Geocoding API and the configuration propagated, the live check passed: both map
selection and converting a typed Lagos street address to valid latitude and
longitude succeeded. Geocoding API must remain enabled in the project that owns
the configured website key and included in the key's API restrictions. These are
separate settings. Hosted-key configuration and actual-device GPS remain outside
this local verification. No actual key is recorded in this document.

## Dropdown and hosting follow-up

The bundled state/LGA source is
https://github.com/temikeezy/nigeria-geojson-data/blob/main/data/lgas.json
(source blob cfdf96821997c66c9e06986c75674ace20b5e714, MIT © 2025 Temi).
Its license is retained in `src/data/nigeria-locations.LICENSE.txt`. Nasarawa's
display spelling is normalized; Lagos display names follow
https://tms.lagosstate.gov.ng/mobile/mComplianceCenter.aspx.
No external location-data request is needed to populate the dropdowns.

2026-11-04: a synthetic browser check on the hosted checkout found no Google
Maps element, confirming the deployed build lacks NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
This explains automatic lookup failure there despite successful local Maps and
geocoding checks. Add the website key to the Vercel project's Production
environment (and Preview when needed), then rebuild/redeploy. The key is never
committed. Hosted success must be verified after that environment update.

Resolved later on 2026-11-04: the user saved the website key in Vercel. Rebuild
commit `6e2ba98e800b7ea661d470038253cf552d692d42` deployed successfully. The live
smoke check on https://alphamarket-weld.vercel.app passed both map loading/click
selection/confirmation and converting a typed Lagos street address into valid
latitude and longitude. The check used synthetic application API responses and
created no real orders, payments or messages.

Dropdown/layout validation: fresh production build and TypeScript passed, with
22 focused unit/API/data checks and 14 address browser checks covering read-only
display, field ordering, dependent dropdowns, state-change reset, stale responses,
account changes, mobile width and geocoded order submission. Pricing and seller
map browser checks also passed. No real orders/payments were created.
