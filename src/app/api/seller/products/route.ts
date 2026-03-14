const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

async function proxySellerCollection(req: Request, method: "GET" | "POST") {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const url = new URL(req.url);
  const params = new URLSearchParams(url.search);
  if (method === "GET") {
    if (!params.has("limit")) params.set("limit", "20");
    if (!params.has("offset")) params.set("offset", "0");
  }
  const search = params.toString() ? `?${params.toString()}` : "";
  const authHeader = req.headers.get("authorization") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
  };

  const body = method === "GET" ? "" : await req.text();
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  const urls = [
    `${API_V1_BASE}/seller/products${search}`,
    `${API_BASE}/seller/products${search}`,
    `${API_BASE}/auth/seller/products${search}`,
  ];

  try {
    let res: Response | null = null;
    for (const url of urls) {
      res = await fetch(url, {
        method,
        headers,
        body: body || undefined,
        cache: "no-store",
      });
      if (res.status !== 404) break;
    }

    if (!res || res.status === 404) {
      return new Response(
        JSON.stringify({
          error: "Upstream endpoint not found.",
          tried: urls,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const text = await res.text();
    if (res.status >= 500) {
      console.error("Seller products upstream 5xx", {
        status: res.status,
        tried: urls,
        bodyPreview: text.slice(0, 400),
      });
    }

    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to reach seller products upstream.",
        details: error instanceof Error ? error.message : "Unknown fetch error",
        tried: urls,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET(req: Request) {
  return proxySellerCollection(req, "GET");
}

export async function POST(req: Request) {
  return proxySellerCollection(req, "POST");
}
