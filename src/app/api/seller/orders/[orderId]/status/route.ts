import type { NextRequest } from "next/server";

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { orderId } = await context.params;
  const safeId = encodeURIComponent(orderId);
  const body = await req.text();

  const authHeader = req.headers.get("authorization") ?? "";
  const cookieHeader = req.headers.get("cookie") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };

  const urls = Array.from(
    new Set([
      `${API_V1_BASE}/seller/orders/${safeId}/status`,
      `${API_BASE}/seller/orders/${safeId}/status`,
      `${API_BASE}/auth/seller/orders/${safeId}/status`,
    ])
  );

  let res: Response | null = null;
  for (const target of urls) {
    const candidate = await fetch(target, {
      method: "PATCH",
      headers,
      body: body || undefined,
      cache: "no-store",
    });
    if (candidate.status === 404) continue;
    res = candidate;
    break;
  }

  if (!res) {
    return new Response(
      JSON.stringify({
        error: "Seller order status endpoint not found on upstream.",
        tried: urls,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
