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

function normalizeBrandsList(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>;
  }
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const candidates = [record.data, record.items, record.brands, record.rows];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item) => item && typeof item === "object") as Array<Record<string, unknown>>;
    }
  }
  return [];
}

function pickFirstBrandId(payload: unknown): string {
  const rows = normalizeBrandsList(payload);
  for (const row of rows) {
    const name =
      (typeof row.name === "string" && row.name.trim()) ||
      (typeof row.title === "string" && row.title.trim()) ||
      (typeof row.brand_name === "string" && row.brand_name.trim()) ||
      "";
    if (!name) continue;

    const idValue = row.id ?? row.uuid ?? row.brand_id ?? row.brandId;
    if (typeof idValue === "string" && idValue.trim()) return idValue.trim();
    if (typeof idValue === "number") return String(idValue);
  }
  return "";
}

async function resolveDefaultBrandId(headers: Record<string, string>): Promise<string> {
  const candidateUrls = Array.from(
    new Set(
      API_BASE_CANDIDATES.flatMap((base) => [
        `${base}/seller/brands?limit=20&offset=0`,
        `${base}/auth/seller/brands?limit=20&offset=0`,
        `${base}/brands?limit=20&offset=0`,
      ])
    )
  );

  for (const candidate of candidateUrls) {
    try {
      const response = await fetch(candidate, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(headers.Authorization ? { Authorization: headers.Authorization } : {}),
          ...(headers.Cookie ? { Cookie: headers.Cookie } : {}),
        },
        cache: "no-store",
      });
      if (!response.ok) continue;
      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = text;
      }
      const brandId = pickFirstBrandId(payload);
      if (brandId) return brandId;
    } catch {
      // ignore and try the next candidate
    }
  }
  return "";
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

  const incomingBody = method === "GET" ? "" : await req.text();
  let body = incomingBody;

  if (method === "POST") {
    let payload: Record<string, unknown> = {};
    try {
      payload = incomingBody ? (JSON.parse(incomingBody) as Record<string, unknown>) : {};
    } catch {
      payload = {};
    }

    // Seller create: reset stale brand fields.
    if ("brandId" in payload) delete payload.brandId;
    if ("brand_id" in payload) delete payload.brand_id;

    // Backend enforces fk_products_brand; attach a valid default brand when available.
    const defaultBrandId = await resolveDefaultBrandId(headers);
    if (!defaultBrandId) {
      return new Response(
        JSON.stringify({
          error:
            "No valid brand is available for seller create. Ask admin to create at least one brand.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    payload.brandId = defaultBrandId;
    payload.brand_id = defaultBrandId;
    body = JSON.stringify(payload);

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
