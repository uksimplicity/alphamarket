const RAW_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_BASE = RAW_BASE.endsWith("/api/v1") ? RAW_BASE : `${RAW_BASE}/api/v1`;

export async function POST(req: Request, context: { params: Promise<{ orderId: string }> }) {
  if (!RAW_BASE) return Response.json({ error: "The order backend is not configured." }, { status: 503 });
  const { orderId } = await context.params;
  if (!orderId?.trim() || [".", ".."].includes(orderId) || /[\/\\\u0000-\u001f]/.test(orderId)) return Response.json({ error: "A valid order ID is required." }, { status: 400 });
  const authorization = (req.headers.get("authorization") ?? "").trim().replace(/^Bearer\s+Bearer\s+/i, "Bearer ");
  const cookie = req.headers.get("cookie") ?? "";
  if (!authorization && !cookie) return Response.json({ error: "Sign in to confirm receipt of your order." }, { status: 401 });
  try {
    // Receipt confirmation can release funds. Never replay it at a guessed fallback URL.
    const response = await fetch(`${API_BASE}/buyer/orders/${encodeURIComponent(orderId)}/confirm-delivery`, {
      method: "POST", headers: { Accept: "application/json", ...(authorization ? { Authorization: authorization } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 300 && response.status < 400) return Response.json({ error: "The service returned an unexpected redirect. Check the order before trying again." }, { status: 502 });
    return new Response(response.status === 204 ? null : await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The delivery-confirmation result could not be verified. Check your order and escrow status before trying again." }, { status: 502 });
  }
}
