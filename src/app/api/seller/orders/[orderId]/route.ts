import type { NextRequest } from "next/server";

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

function orderNotFound(orderId: string) {
  return new Response(
    JSON.stringify({
      error: "Order not found.",
      orderId,
      fallback: true,
    }),
    { status: 404, headers: { "Content-Type": "application/json" } }
  );
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await context.params;
  const { search } = new URL(req.url);

  if (!API_BASE) {
    return orderNotFound(orderId);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
  };

  const safeId = encodeURIComponent(orderId);
  const urls = Array.from(
    new Set([
      `${API_V1_BASE}/seller/orders/${safeId}${search}`,
      `${API_BASE}/seller/orders/${safeId}${search}`,
      `${API_BASE}/auth/seller/orders/${safeId}${search}`,
    ])
  );

  try {
    let res: Response | null = null;
    let upstreamErrorRes: Response | null = null;
    for (const candidate of urls) {
      res = await fetch(candidate, { method: "GET", headers, cache: "no-store" });
      if (res.status === 404) continue;
      if (res.status >= 500) {
        upstreamErrorRes = res;
        continue;
      }
      break;
    }

    if ((!res || res.status === 404) && !upstreamErrorRes) {
      return orderNotFound(orderId);
    }

    const finalRes = upstreamErrorRes ?? res;
    if (!finalRes) {
      return orderNotFound(orderId);
    }

    const text = await finalRes.text();
    if (finalRes.status >= 500) {
      return orderNotFound(orderId);
    }

    return new Response(text, {
      status: finalRes.status,
      headers: {
        "Content-Type": finalRes.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return orderNotFound(orderId);
  }
}
