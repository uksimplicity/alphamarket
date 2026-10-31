import { sellerRequest } from "../../../productUpstream";

export async function GET(req: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  return sellerRequest(req, `/seller/product/${encodeURIComponent(productId)}/attributes`);
}
