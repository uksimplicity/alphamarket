const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

export async function GET(req: Request) {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { search } = new URL(req.url);
  const authHeader = req.headers.get("authorization") ?? "";
  const cookieHeader = req.headers.get("cookie") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };
  const urls = Array.from(
    new Set([
      `${API_V1_BASE}/seller/product-types${search}`,
      `${API_BASE}/seller/product-types${search}`,
    ])
  );
  for (const target of urls) {
    const res = await fetch(target, { method: "GET", headers, cache: "no-store" });
    if (res.status === 404) continue;
    return new Response(await res.text(), {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: "Seller product-types endpoint not found.", tried: urls }), {
    status: 502,
    headers: { "Content-Type": "application/json" },
  });
}
