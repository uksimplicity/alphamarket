import { problem, productBody, sellerAccess, sellerRequest } from "../../../seller/productUpstream";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  const { id } = await context.params;
  if (!id.trim()) return problem("A location is required.");
  const body = await productBody(req);
  if (!body || typeof body.is_active !== "boolean") return problem("Choose an active status.");
  return sellerRequest(req, `/admin/ad-locations/${encodeURIComponent(id)}`, "PUT", { is_active: body.is_active });
}
