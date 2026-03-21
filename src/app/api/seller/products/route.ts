const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;
const API_ROOT_BASE = API_BASE.endsWith("/api/v1") ? API_BASE.slice(0, -"/api/v1".length) : API_BASE;
const API_BASE_CANDIDATES = Array.from(new Set([API_BASE, API_V1_BASE, `${API_ROOT_BASE}/api/v1`, API_ROOT_BASE]));
const MAX_PRODUCT_PRICE = 1000000000;
const MAX_PRODUCT_STOCK = 1000000;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function validateCreatePayload(payload: Record<string, unknown>) {
  const name = readString(payload.name ?? payload.title);
  if (!name) {
    return "Product title is required.";
  }

  const description = readString(payload.shortDescription ?? payload.description);
  if (!description) {
    return "Product description is required.";
  }

  const categoryId = readString(payload.categoryId ?? payload.category_id ?? payload.category);
  if (!categoryId) {
    return "Category is required.";
  }

  const basePrice = readNumber(payload.basePrice ?? payload.base_price ?? payload.price);
  if (basePrice === null || basePrice <= 0) {
    return "Base price must be greater than 0.";
  }
  if (basePrice > MAX_PRODUCT_PRICE) {
    return `Base price is too large. Maximum allowed is ${MAX_PRODUCT_PRICE.toLocaleString()}.`;
  }

  const stockRaw = payload.stock ?? payload.quantity ?? payload.availableQuantity;
  if (stockRaw !== undefined && stockRaw !== null && String(stockRaw).trim() !== "") {
    const stock = readNumber(stockRaw);
    if (stock === null || !Number.isInteger(stock)) {
      return "Stock must be a whole number.";
    }
    if (stock < 0) {
      return "Stock cannot be negative.";
    }
    if (stock > MAX_PRODUCT_STOCK) {
      return `Stock is too large. Maximum allowed is ${MAX_PRODUCT_STOCK.toLocaleString()}.`;
    }
  }

  return null;
}

function normalizeAuthHeader(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^Bearer\s+Bearer\s+/i, "Bearer ");
}

async function proxySellerCollection(req: Request, method: "GET" | "POST") {
  const url = new URL(req.url);
  const params = new URLSearchParams(url.search);
  params.delete("ts");
  params.delete("_");
  params.delete("cacheBust");
  if (method === "GET") {
    if (!params.has("limit")) params.set("limit", "20");
    if (!params.has("offset")) params.set("offset", "0");
  }
  const search = params.toString() ? `?${params.toString()}` : "";

  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const authHeader = normalizeAuthHeader(req.headers.get("authorization") ?? "");
  const cookieHeader = req.headers.get("cookie") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };

  const body = method === "GET" ? "" : await req.text();

  if (method === "POST") {
    let payload: Record<string, unknown> = {};
    try {
      payload = body ? (JSON.parse(body) as Record<string, unknown>) : {};
    } catch {
      payload = {};
    }

    const validationError = validateCreatePayload(payload);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  const queryVariants =
    method === "GET"
      ? Array.from(new Set([search, ""]))
      : [search];
  const urls = Array.from(
    new Set(
      queryVariants.flatMap((query) =>
        API_BASE_CANDIDATES.flatMap((base) => [
          `${base}/seller/products${query}`,
          `${base}/auth/seller/products${query}`,
          `${base}/products${query}`,
        ])
      )
    )
  );

  try {
    let res: Response | null = null;
    let upstreamErrorRes: Response | null = null;
    const attempts: Array<{ url: string; status: number }> = [];

    for (const url of urls) {
      res = await fetch(url, {
        method,
        headers,
        body: body || undefined,
        cache: "no-store",
      });
      attempts.push({ url, status: res.status });
      if (res.status === 404) continue;
      if (res.status >= 500) {
        upstreamErrorRes = res;
        continue;
      }
      if (
        method === "GET" &&
        (res.status === 400 ||
          res.status === 401 ||
          res.status === 403 ||
          res.status === 405 ||
          res.status === 422)
      ) {
        continue;
      }
      break;
    }

    if ((!res || res.status === 404) && !upstreamErrorRes) {
      return new Response(
        JSON.stringify({
          error: "Upstream endpoint not found.",
          tried: urls,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const finalRes = upstreamErrorRes ?? res;
    if (!finalRes) {
      return new Response(
        JSON.stringify({
          error: "Seller products proxy had no upstream response.",
          tried: urls,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const text = await finalRes.text();

    if (finalRes.status >= 500) {
      console.error("Seller products upstream 5xx", {
        status: finalRes.status,
        tried: urls,
        attempts,
        bodyPreview: text.slice(0, 400),
      });
    }

    return new Response(text, {
      status: finalRes.status,
      headers: {
        "Content-Type": finalRes.headers.get("content-type") ?? "application/json",
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
