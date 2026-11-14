import { problem, sellerAccess, sellerRequest } from "../productUpstream";
import { locationRows, type SupportedLocation } from "@/components/products/supportedLocations";

export async function GET(req: Request) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  const locations = new Map<string, SupportedLocation>();
  for (let offset = 0; offset < 10_000; offset += 100) {
    const response = await sellerRequest(req, `/ads/locations?limit=100&offset=${offset}`);
    if (!response.ok) return response;
    let payload: unknown;
    try { payload = await response.json(); }
    catch { return problem("Supported locations could not be read. Please retry.", 502); }
    const rows = locationRows(payload);
    if (!rows) return problem("Supported locations could not be read. Please retry.", 502);
    for (const row of rows) if (row.id.trim() && row.name.trim() && row.is_active !== false) locations.set(row.id, row);
    if (rows.length < 100) return Response.json({ data: [...locations.values()] }, { headers: { "Cache-Control": "no-store" } });
  }
  return problem("The location directory could not be fully loaded. Please retry.", 502);
}
