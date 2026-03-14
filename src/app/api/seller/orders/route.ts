const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

function emptyOrdersResponse() {
  return new Response(
    JSON.stringify({
      data: [],
      fallback: true,
      warning: "Seller orders fallback mode.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const params = new URLSearchParams(url.search);
  if (!params.has("limit")) params.set("limit", "20");
  if (!params.has("offset")) params.set("offset", "0");
  const search = params.toString() ? `?${params.toString()}` : "";

  if (!API_BASE) {
    return emptyOrdersResponse();
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
  };

  const urls = Array.from(
    new Set([
      `${API_V1_BASE}/seller/orders${search}`,
      `${API_BASE}/seller/orders${search}`,
      `${API_BASE}/auth/seller/orders${search}`,
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
      return emptyOrdersResponse();
    }

    const finalRes = upstreamErrorRes ?? res;
    if (!finalRes) {
      return emptyOrdersResponse();
    }

    const text = await finalRes.text();
    if (finalRes.status >= 500) {
      return emptyOrdersResponse();
    }

    return new Response(text, {
      status: finalRes.status,
      headers: {
        "Content-Type": finalRes.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return emptyOrdersResponse();
  }
}
