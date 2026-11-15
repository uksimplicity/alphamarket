import { invalidProduct, problem, productBody, sellerAccess, sellerRequest } from "../productUpstream";
import { selectedSellerLocation, sellerLocation } from "../sellerLocation";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

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
  // Persist media through the product update endpoint after creation.
  // Keep the original upload URLs; display URL conversion is not storage data.
  const { media, ...details } = body;
  const created = await sellerRequest(req, "/seller/product", "POST", { ...details, locationId });
  if (!created.ok) return created;
  const result = record(await created.clone().json());
  if (result.success === false) return created;
  const data = record(result.data ?? result);
  const product = record(data.product ?? data);
  const productId = product.id ?? product.product_id ?? product.productId;
  const sellerId = body.sellerId ?? product.seller_id ?? product.sellerId;
  function incomplete(error: string) {
    return Response.json({
      error, productCreated: true,
      ...(typeof productId === "string" && productId.trim() ? { productId } : {}),
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  if (typeof productId !== "string" || !productId.trim() || typeof sellerId !== "string" || !sellerId.trim()) {
    return incomplete("Product was created, but the response did not include the IDs needed to save its images. Check your products before submitting again.");
  }
  const updated = await sellerRequest(req, `/seller/product/${encodeURIComponent(productId)}`, "PUT", {
    product_id: productId, seller_id: sellerId, media,
  });
  if (!updated.ok) return incomplete("Product was created, but its image save was not confirmed. Open the existing product to check or update its images; do not create it again.");
  if (updated.status !== 204 && record(await updated.clone().json()).success === false) {
    return incomplete("Product was created, but the image update was rejected. Open the existing product to update its images; do not create it again.");
  }
  return created;
}
