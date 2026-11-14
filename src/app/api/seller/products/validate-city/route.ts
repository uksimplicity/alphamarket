import { problem, sellerAccess } from "../../productUpstream";
import { sellerLocation } from "../../sellerLocation";

export async function GET(req: Request) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  const city = new URL(req.url).searchParams.get("city")?.trim();
  if (!city) return problem("Enter the city where this product is located.");
  const locationId = await sellerLocation(req, city);
  if (locationId instanceof Response) return locationId;
  return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
