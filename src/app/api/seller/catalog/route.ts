const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

const ALLOWED_RESOURCES = new Set([
  "categories",
  "product-types",
  "brands",
  "tags",
  "attributes",
]);

function emptyCatalog(resource: string) {
  return new Response(
    JSON.stringify({
      data: [],
      resource,
      fallback: true,
      warning: "Catalog fallback mode.",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const resource = String(url.searchParams.get("resource") ?? "").trim();
  const limit = String(url.searchParams.get("limit") ?? "200");
  const offset = String(url.searchParams.get("offset") ?? "0");

  if (!ALLOWED_RESOURCES.has(resource)) {
    return new Response(
      JSON.stringify({
        error: "Invalid resource. Allowed: categories, product-types, brands, tags, attributes.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!API_BASE) {
    return emptyCatalog(resource);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
  };

  const search = new URLSearchParams({ limit, offset }).toString();
  const urls = Array.from(
    new Set([
      `${API_V1_BASE}/seller/${resource}?${search}`,
      `${API_BASE}/seller/${resource}?${search}`,
      `${API_BASE}/auth/seller/${resource}?${search}`,
    ])
  );

  try {
    let res: Response | null = null;
    let upstreamErrorRes: Response | null = null;

    for (const candidate of urls) {
      res = await fetch(candidate, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      if (res.status === 404) continue;
      if (res.status >= 500) {
        upstreamErrorRes = res;
        continue;
      }
      break;
    }

    if ((!res || res.status === 404) && !upstreamErrorRes) {
      return emptyCatalog(resource);
    }

    const finalRes = upstreamErrorRes ?? res;
    if (!finalRes) {
      return emptyCatalog(resource);
    }

    const text = await finalRes.text();
    if (finalRes.status >= 500) {
      return emptyCatalog(resource);
    }

    return new Response(text, {
      status: finalRes.status,
      headers: {
        "Content-Type": finalRes.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return emptyCatalog(resource);
  }
}
