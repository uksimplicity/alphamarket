import { invalidProduct, problem, productBody, sellerAccess, sellerRequest } from "../productUpstream";

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
  return sellerRequest(req, "/seller/product", "POST", body);
}
