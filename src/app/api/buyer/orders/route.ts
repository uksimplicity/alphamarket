const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

export async function POST(req: Request) {
  if (!API_BASE) return Response.json({ error: "Order backend is not configured." }, { status: 503 });
  const body = await req.text();
  const authorization = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  if (!authorization && !cookie) return Response.json({ error: "Please sign in to place your order." }, { status: 401 });

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
