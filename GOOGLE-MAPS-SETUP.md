# Google Maps on the marketplace website

The checkout and saved-address editor share a map picker. Users click the map, drag the pin or request their current location,
then explicitly confirm. Coordinates are kept internal. Cancel leaves the previous point unchanged.
The address book also locates a typed address when saving. It accepts a single,
specific building-level match; incomplete or ambiguous results require map confirmation.

## Google Cloud configuration

Use a separate website key in the existing billed project. Keep the Android key's
Android application restrictions unchanged.

1. Enable **Maps JavaScript API** and **Geocoding API** in the same project.
2. Create an API key named `Marketplace Web`.
3. Select **Websites** under application restrictions. Add:
   - `https://alphamarket-weld.vercel.app/*`
   - `http://localhost:3000/*`
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
saving a typed address. Local tests use synthetic coordinates and never change live
accounts or create real orders/products.

References:
- https://developers.google.com/maps/documentation/javascript/get-api-key
- https://developers.google.com/maps/documentation/javascript/geocoding
