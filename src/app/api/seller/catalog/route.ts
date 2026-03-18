const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_ROOT_BASE = API_BASE.endsWith("/api/v1") ? API_BASE.slice(0, -"/api/v1".length) : API_BASE;
const API_BASE_CANDIDATES = Array.from(new Set([API_BASE, `${API_ROOT_BASE}/api/v1`, API_ROOT_BASE]));

const ALLOWED_RESOURCES = new Set([
  "categories",
  "product-types",
  "brands",
  "tags",
  "attributes",
]);

const RESOURCE_ALIASES: Record<string, string[]> = {
  categories: ["categories", "category"],
  "product-types": ["product-types", "product_type", "product-types", "producttype", "types"],
  brands: ["brands", "brand"],
  tags: ["tags", "tag"],
  attributes: ["attributes", "attribute"],
};

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

function normalizeAuthHeader(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^Bearer\s+Bearer\s+/i, "Bearer ");
}

function getValueCaseInsensitive(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }
  const lowered = new Map(
    Object.entries(record).map(([key, value]) => [key.toLowerCase(), value])
  );
  for (const key of keys) {
    const value = lowered.get(key.toLowerCase());
    if (value !== undefined) return value;
  }
  return undefined;
}

function hasCatalogRecords(payload: unknown): boolean {
  const visited = new WeakSet<object>();

  function walk(value: unknown): boolean {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (walk(item)) return true;
      }
      return false;
    }
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    if (visited.has(record)) return false;
    visited.add(record);

    const idCandidate = getValueCaseInsensitive(record, [
      "id",
      "uuid",
      "category_id",
      "categoryId",
      "categoryID",
      "product_type_id",
      "productTypeId",
      "type_id",
      "typeId",
    ]);
    const nameCandidate = getValueCaseInsensitive(record, [
      "name",
      "title",
      "category",
      "type",
      "productType",
      "product_type_name",
      "productTypeName",
      "category_name",
      "categoryName",
      "type_name",
      "product_type",
      "label",
    ]);
    const hasId = typeof idCandidate === "string" || typeof idCandidate === "number";
    const hasName = typeof nameCandidate === "string" || typeof nameCandidate === "number";
    if (hasId && hasName) return true;

    return Object.values(record).some((nested) => walk(nested));
  }

  return walk(payload);
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

  const authHeader = normalizeAuthHeader(req.headers.get("authorization") ?? "");
  const cookieHeader = req.headers.get("cookie") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };

  const search = new URLSearchParams({ limit, offset }).toString();
  const resourcePaths = RESOURCE_ALIASES[resource] ?? [resource];
  const pathPrefixes = ["seller", "auth/seller", "admin", "auth/admin", "auth", ""];
  const urls = Array.from(
    new Set(
      API_BASE_CANDIDATES.flatMap((base) =>
        pathPrefixes.flatMap((prefix) =>
          resourcePaths.map((resourcePath) => {
            const cleanedPrefix = prefix.trim().replace(/^\/+|\/+$/g, "");
            const cleanedResource = resourcePath.trim().replace(/^\/+|\/+$/g, "");
            const path = cleanedPrefix ? `${cleanedPrefix}/${cleanedResource}` : cleanedResource;
            return `${base}/${path}?${search}`;
          })
        )
      )
    )
  );

  try {
    let upstreamErrorRes: Response | null = null;
    let lastClientErrorStatus = 0;
    let lastClientErrorText = "";
    let lastClientErrorUrl = "";

    for (const candidate of urls) {
      const res = await fetch(candidate, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      if (res.status === 404) continue;
      if (res.status >= 500) {
        upstreamErrorRes = res;
        continue;
      }
      if (res.ok) {
        const text = await res.text();
        let payload: unknown = text;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
          payload = text;
        }
        if (!hasCatalogRecords(payload)) {
          continue;
        }
        return new Response(
          typeof payload === "string" ? payload : JSON.stringify(payload),
          {
            status: res.status,
            headers: {
              "Content-Type": res.headers.get("content-type") ?? "application/json",
            },
          }
        );
      }
      const text = await res.text();
      lastClientErrorStatus = res.status;
      lastClientErrorText = text.slice(0, 1000);
      lastClientErrorUrl = candidate;
      continue;
    }

    if (!upstreamErrorRes) {
      if (lastClientErrorStatus > 0) {
        return new Response(
          JSON.stringify({
            error: `Catalog request failed (${lastClientErrorStatus}).`,
            resource,
            upstream: lastClientErrorUrl,
            details: lastClientErrorText,
          }),
          { status: lastClientErrorStatus, headers: { "Content-Type": "application/json" } }
        );
      }
      return emptyCatalog(resource);
    }

    if (upstreamErrorRes.status >= 500) {
      return emptyCatalog(resource);
    }

    return emptyCatalog(resource);
  } catch {
    return emptyCatalog(resource);
  }
}
