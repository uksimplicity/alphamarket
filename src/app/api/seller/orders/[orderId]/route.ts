import { orderRequest } from "../../orderUpstream";

export async function GET(req: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  return orderRequest(req, `/user/orders/${encodeURIComponent(orderId)}`);
}
