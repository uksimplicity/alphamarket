import { problem, productBody, sellerAccess, sellerRequest } from "../../seller/productUpstream";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const limit = Number(params.get("limit") ?? 100), offset = Number(params.get("offset") ?? 0);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) return problem("Invalid pagination.");
  return sellerRequest(req, `/admin/ad-locations?${new URLSearchParams({ limit: String(limit), offset: String(offset) })}`);
}

export async function POST(req: Request) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  const body = await productBody(req);
  if (!body || typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 150) return problem("Enter a location name of at most 150 characters.");
  if (!["country", "state", "city", "area"].includes(String(body.type))) return problem("Choose a location type.");
  if (body.parent_id !== undefined && (typeof body.parent_id !== "string" || !body.parent_id.trim())) return problem("Choose a valid parent location.");
  return sellerRequest(req, "/admin/ad-locations", "POST", {
    name: body.name.trim(), type: body.type, is_active: true,
    ...(body.parent_id ? { parent_id: body.parent_id } : {}),
  });
}
