import { problem, sellerRequest } from "../productUpstream";

const resources = new Set(["categories", "product-types", "brands", "tags", "attributes"]);
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const resource = params.get("resource") ?? "";
  if (!resources.has(resource)) return problem("Invalid catalogue resource.");
  const id = params.get("id");
  if (id) return sellerRequest(req, `/seller/${resource}/${encodeURIComponent(id)}`);
  const limit = Number(params.get("limit") ?? 200), offset = Number(params.get("offset") ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || !Number.isInteger(offset) || offset < 0) return problem("Invalid pagination.");
  return sellerRequest(req, `/seller/${resource}?limit=${limit}&offset=${offset}`);
}
