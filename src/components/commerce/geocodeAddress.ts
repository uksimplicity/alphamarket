import { deliveryPoint, type DeliveryPoint } from "./addresses";
import { loadGoogleMaps } from "./googleMapsLoader";

const unavailable = "We couldn't locate this address automatically. Choose the delivery location on the map or use your current location if you are at this address.";
const imprecise = "Add the city and state to your full address, or choose the exact delivery location on the map.";

/** Only accept a single building-level match; a street or city centre is not a delivery point. */
export async function geocodeDeliveryAddress(address: string, key: string): Promise<DeliveryPoint> {
  if (!address.trim()) throw new Error("Enter the full delivery address.");
  let api;
  try { api = await loadGoogleMaps(key); } catch { throw new Error(unavailable); }
  const Geocoder = api.Geocoder;
  if (!Geocoder) throw new Error(unavailable);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(unavailable)), 10000);
    try {
      new Geocoder().geocode({ address: address.trim(), region: "ng" }, (results, status) => {
        clearTimeout(timeout);
        if (status !== "OK") { reject(new Error(status === "ZERO_RESULTS" ? imprecise : unavailable)); return; }
        const result = results?.length === 1 ? results[0] : null;
        if (!result || result.partial_match || !result.types.some(type => ["street_address", "premise", "subpremise"].includes(type)) || !["ROOFTOP", "RANGE_INTERPOLATED"].includes(result.geometry.location_type)) {
          reject(new Error(imprecise)); return;
        }
        const point = deliveryPoint(String(result.geometry.location.lat()), String(result.geometry.location.lng()));
        if (!point) { reject(new Error(imprecise)); return; }
        resolve(point);
      });
    } catch { clearTimeout(timeout); reject(new Error(unavailable)); }
  });
}
