import { problem, sellerAccess } from "../../productUpstream";
import { selectedSellerLocation, sellerLocation } from "../../sellerLocation";

export async function GET(req: Request) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  const params = new URL(req.url).searchParams;
  const city = params.get("city")?.trim();
  const selectedId = params.get("locationId");
  if (selectedId === null && !city) return problem("Enter the city where this product is located.");
  const locationId = selectedId !== null
    ? await selectedSellerLocation(req, selectedId)
    : await sellerLocation(req, city!);
  if (locationId instanceof Response) return locationId;
  return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
