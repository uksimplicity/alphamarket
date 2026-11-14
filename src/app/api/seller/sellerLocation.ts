import { problem, sellerRequest } from "./productUpstream";
import { locationRows, type SupportedLocation } from "@/components/products/supportedLocations";

const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");

export async function selectedSellerLocation(req: Request, id: string): Promise<string | Response> {
  if (!id.trim()) return problem("Select a supported location.");
  const response = await sellerRequest(req, `/ads/locations/${encodeURIComponent(id.trim())}`);
  if (!response.ok) return response;
  let payload: unknown;
  try { payload = await response.json(); }
  catch { return problem("The selected location could not be verified. Please retry.", 502); }
  for (let depth = 0; depth < 5; depth++) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) break;
    const row = payload as Record<string, unknown>;
    if (row.success === false) break;
    if (row.id === id.trim() && typeof row.name === "string") {
      if (row.is_active === false) return problem("This location is no longer active. Select another location.", 422);
      return id.trim();
    }
    payload = row.data ?? row.location;
  }
  return problem("The selected location could not be verified. Select another location.", 422);
}

export async function sellerLocation(req: Request, city: string): Promise<string | Response> {
  // Resolve the product's region from the directory, never from a user/address ID.
  const matches = new Map<string, SupportedLocation>();
  for (let offset = 0; offset < 10_000; offset += 100) {
    const query = new URLSearchParams({ type: "city", search: city.trim(), limit: "100", offset: String(offset) });
    const response = await sellerRequest(req, `/ads/locations?${query}`);
    if (!response.ok) return response;
    let payload: unknown;
    try { payload = await response.json(); }
    catch { return problem("Supported cities could not be read. Please retry.", 502); }
    const rows = locationRows(payload);
    if (!rows) return problem("Supported cities could not be read. Please retry.", 502);
    for (const row of rows) {
      if (row.id.trim() && normalized(row.name) === normalized(city) && row.is_active !== false && (!row.type || row.type === "city")) matches.set(row.id, row);
    }
    if (rows.length < 100) {
      if (matches.size === 1) return [...matches.keys()][0];
      if (matches.size > 1) return problem("More than one supported city has this name. Ask an administrator to check the city records before publishing.", 409);
      return problem(`Product creation is unavailable for ${city.trim()} until an administrator adds or activates this city in Admin.`, 422);
    }
  }
  return problem("The supported-city search could not be completed. Please ask an administrator to check the city records.", 502);
}
