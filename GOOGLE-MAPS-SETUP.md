# Google Maps on the marketplace website

The checkout, saved-address editor and seller product creation form share a map
picker. Users click the map, drag the pin or request their current location,
then explicitly confirm. Coordinates are kept internal. Cancel leaves the previous point unchanged.
The address book also locates a typed address when saving. It accepts a single,
specific building-level match; incomplete or ambiguous results require map confirmation.
The product form keeps the typed pickup address; its selected coordinates are sent
as `latitude` and `longitude`. Changing the address clears its old selected point.
The account profile coordinates are not substituted for a product's location.

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

This check uses a synthetic buyer, loads the real Google map, clicks a location
and confirms it. Application API calls are intercepted; it creates no orders,
makes no payments and does not request device GPS. Use `MAPS_SMOKE_ORIGIN` to
check another localhost or 127.0.0.1 preview origin. A pass does not establish
that geocoding, real-device GPS, pin dragging or the hosted website work.
