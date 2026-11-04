const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

export async function POST(req: Request) {
  if (!API_BASE) return Response.json({ error: "Order backend is not configured." }, { status: 503 });
  const authorization = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  if (!authorization && !cookie) return Response.json({ error: "Please sign in to place your order." }, { status: 401 });
  let body: string;
  try {
    const input = await req.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    const payload: Record<string, unknown> = {};
    for (const key of ["buyer_id", "payment_method", "dropoff_address", "dropoff_contact", "dropoff_lat", "dropoff_lng"]) if (input[key] !== undefined) payload[key] = input[key];
    if (Array.isArray(input.items)) payload.items = input.items.map((item: Record<string, unknown> | null) => ({ product_id: item?.product_id, quantity: item?.quantity }));
    body = JSON.stringify(payload);
  } catch { return Response.json({ error: "A valid order request is required." }, { status: 400 }); }

  try {
    // A lost response must not create another order through an alternative endpoint.
    const response = await fetch(`${API_V1_BASE}/buyer/orders`, {
      method: "POST",
      headers: {
        Accept: "application/json", "Content-Type": "application/json",
        ...(authorization ? { Authorization: authorization } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 300 && response.status < 400) {
      return Response.json({ error: "Unexpected order service redirect. Check My Orders before submitting again." }, { status: 502 });
    }
    const text = await response.text();
    return new Response(response.status === 204 ? null : text, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "The order response could not be confirmed. Check My Orders before submitting again." }, { status: 502 });
  }
}
