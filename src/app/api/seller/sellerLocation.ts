import { problem, sellerRequest } from "./productUpstream";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

// Only explicit location IDs qualify. A user/address ID or city name is not a
// supported-location ID, even when it happens to be a UUID.
export function savedLocationId(payload: unknown, depth = 0): string | null {
  const value = record(payload);
  if (!value || depth > 6 || value.success === false) return null;
  for (const key of ["locationId", "location_id", "locationID", "LocationID"]) {
    const id = value[key];
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  const location = record(value.location);
  if (location) {
    const id = location.id;
    if (typeof id === "string" && id.trim()) return id.trim();
  }
  for (const key of ["data", "user", "profile", "result", "address", "pickup_address", "pickupAddress"]) {
    const id = savedLocationId(value[key], depth + 1);
    if (id) return id;
  }
  return null;
}

export async function sellerLocation(req: Request): Promise<string | Response> {
  // Read with the same bearer token as the write; never use a cached address
  // from another account or trust a location ID supplied by the product form.
  const response = await sellerRequest(req, "/user/profile");
  if (!response.ok) {
    return problem("Could not load your saved seller address. Please retry before creating the product.", response.status);
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch { return problem("Your seller address could not be read. Please retry.", 502); }
  if (record(payload)?.success === false) return problem("Your seller address could not be loaded. Please retry.", 502);
  const id = savedLocationId(payload);
  return id ?? problem("Your saved seller address has no location ID. Please contact support to complete your account location.");
}
