import { invalidProduct, problem, productBody, productRows, sellerAccess, sellerRequest } from "../../productUpstream";

type Context = { params: Promise<{ productId: string }> };

// Swagger has no seller detail GET. Find the exact ID in this authenticated seller's list.
export async function GET(req: Request, context: Context) {
  const { productId } = await context.params;
  const seen = new Set<string>();
  for (let offset = 0; offset < 10_000;) {
    const response = await sellerRequest(req, `/seller/products?limit=200&offset=${offset}`);
    if (!response.ok) return response;
    const rows = productRows(await response.json());
    if (!rows) return problem("Marketplace returned an unreadable product list.", 502);
    const found = rows.find(row => String(row.id ?? row.productId ?? row.product_id ?? row.uuid ?? "") === productId);
    if (found) return Response.json({ data: found }, { headers: { "Cache-Control": "no-store" } });
    if (!rows.length) return problem("Product not found in your inventory.", 404);
    const signature = JSON.stringify(rows.map(row => row.id ?? row.productId ?? row.product_id ?? row.uuid));
    if (seen.has(signature)) return problem("Marketplace did not advance the inventory page.", 502);
    seen.add(signature);
    offset += rows.length;
  }
  return problem("Inventory lookup limit reached. Narrow the inventory before trying again.", 502);
}

export async function PUT(req: Request, context: Context) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  const { productId } = await context.params;
  const body = await productBody(req);
  if (!body || !Object.keys(body).length) return problem("Product changes are required.");
  const error = invalidProduct(body);
  if (error) return problem(error);
  return sellerRequest(req, `/seller/product/${encodeURIComponent(productId)}`, "PUT", { ...body, product_id: productId });
}

// Existing stock editors use PATCH locally; the documented upstream method is PUT.
export const PATCH = PUT;

export async function DELETE(req: Request, context: Context) {
  const { productId } = await context.params;
  return sellerRequest(req, `/seller/product/${encodeURIComponent(productId)}`, "DELETE");
}
