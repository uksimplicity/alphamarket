import { invalidProduct, problem, productBody, sellerAccess, sellerRequest } from "../productUpstream";
import { selectedSellerLocation, sellerLocation } from "../sellerLocation";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const query = new URLSearchParams();
  for (const [key, fallback, maximum] of [["limit", 20, 200], ["offset", 0, 1e7]] as const) {
    const value = params.has(key) ? Number(params.get(key)) : fallback;
    if (!Number.isInteger(value) || value < (key === "limit" ? 1 : 0) || value > maximum) return problem("Invalid pagination.");
    query.set(key, String(value));
  }
  if (params.get("search")) query.set("search", params.get("search")!);
  return sellerRequest(req, `/seller/products?${query}`);
}

export async function POST(req: Request) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  const body = await productBody(req);
  if (!body) return problem("A product object is required.");
  const error = invalidProduct(body, true);
  if (error) return problem(error);
  if ("locationId" in body && typeof body.locationId !== "string") return problem("Select a supported location.");
  const locationId = typeof body.locationId === "string"
    ? await selectedSellerLocation(req, body.locationId)
    : await sellerLocation(req, (body.location as string).trim());
  if (locationId instanceof Response) return locationId;
  return sellerRequest(req, "/seller/product", "POST", { ...body, locationId });
}
