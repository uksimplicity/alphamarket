import { problem } from "./seller/productUpstream";

export type AdsScope = "public" | "mine" | "admin" | "plans" | "promotions";
const id = "[^/]+";
const rules: Record<AdsScope, Record<string, RegExp>> = {
  public: { GET: new RegExp(`^(|categories|locations|locations/${id}|promoted|promotion-types|${id})$`) },
  mine: {
    GET: new RegExp(`^(|posting-fee|${id}|${id}/(history|promotion-plans|promotions))$`),
    POST: new RegExp(`^(|${id}/(promotions|resubmit))$`), PUT: new RegExp(`^${id}$`), DELETE: new RegExp(`^${id}$`),
  },
  admin: {
    GET: new RegExp(`^(|fees|fees/quote|stats|moderation-logs|${id}|${id}/moderation-logs)$`),
    PUT: new RegExp(`^(${id}|fees/default|fees/categories/${id})$`),
    DELETE: new RegExp(`^(${id}|fees/categories/${id})$`),
    POST: new RegExp(`^${id}/(approve|reject|request-changes|suspend|unsuspend)$`),
  },
  plans: { GET: new RegExp(`^(|${id})$`), POST: /^$/, PUT: new RegExp(`^${id}$`), DELETE: new RegExp(`^${id}$`) },
  promotions: { GET: /^$/, POST: new RegExp(`^${id}/cancel$`) },
};
const roots: Record<AdsScope, string> = { public: "/ads", mine: "/user/ads", admin: "/admin/ads", plans: "/admin/promotion-plans", promotions: "/admin/promotions" };
function queryKeys(scope: AdsScope, path: string, method: string): Set<string> {
  if (method !== "GET") return new Set();
  let keys: string[] = [];
  if (scope === "public") {
    if (!path) keys = ["search", "category_id", "category", "location_id", "location", "lat", "lng", "radius_km", "promotion", "promoted", "min_price", "max_price", "seller_id", "sort", "limit", "offset"];
    else if (path === "promoted") keys = ["type", "category_id", "category", "location_id", "location", "limit", "offset"];
    else if (path === "categories") keys = ["limit", "offset"];
    else if (path === "locations") keys = ["parent_id", "root", "type", "search", "limit", "offset"];
  } else if (scope === "mine") {
    if (!path) keys = ["status", "limit", "offset"];
    else if (path === "posting-fee") keys = ["category_id"];
    else if (/\/(history|promotions)$/.test(path)) keys = ["limit", "offset"];
  } else if (scope === "admin") {
    if (!path) keys = ["status", "owner_id", "poster_role", "category_id", "location_id", "search", "promoted", "include_deleted", "limit", "offset"];
    else if (path === "fees/quote") keys = ["category_id"];
    else if (path === "moderation-logs") keys = ["product_id", "actor_id", "action", "from", "to", "limit", "offset"];
    else if (path.endsWith("/moderation-logs")) keys = ["limit", "offset"];
  } else if (scope === "plans" && !path) keys = ["type", "is_active"];
  else if (scope === "promotions" && !path) keys = ["status", "type", "product_id", "owner_id", "limit", "offset"];
  return new Set(keys);
}

export async function forwardAds(req: Request, scope: AdsScope, parts: string[] = []) {
  if (parts.some(part => !part || part === "." || part === ".." || /[\\/\x00-\x1f]/.test(part))) return problem("Invalid Ads route.", 400);
  const path = parts.join("/");
  if (!rules[scope][req.method]?.test(path)) return problem("This Ads operation is not supported.", 405);
  const authorization = req.headers.get("authorization")?.trim() ?? "";
  if (scope !== "public" && !/^Bearer\s+\S+$/i.test(authorization)) return problem("Sign in to continue.", 401);
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!raw) return problem("Marketplace service is unavailable.", 503);
  let base: string;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error();
    base = raw.endsWith("/api/v1") ? raw : `${raw}/api/v1`;
  } catch { return problem("Marketplace service is unavailable.", 503); }
  const query = new URLSearchParams();
  const queries = queryKeys(scope, path, req.method);
  for (const [key, value] of new URL(req.url).searchParams) {
    if (!queries.has(key)) return problem("Invalid Ads filter.");
    if (["limit", "offset"].includes(key)) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < (key === "limit" ? 1 : 0) || number > (key === "limit" ? 200 : 1e7)) return problem("Invalid pagination.");
    }
    query.set(key, value);
  }
  let body: string | undefined;
  if (req.method !== "GET") {
    const text = await req.text();
    if (text) {
      try {
        const value = JSON.parse(text);
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
        body = JSON.stringify(value);
      } catch { return problem("A valid Ads request object is required."); }
    }
  }
  try {
    const response = await fetch(`${base}${roots[scope]}${parts.length ? `/${parts.map(encodeURIComponent).join("/")}` : ""}${query.size ? `?${query}` : ""}`, {
      method: req.method, headers: { Accept: "application/json", ...(scope !== "public" ? { Authorization: authorization } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(25_000),
    });
    if (response.status >= 300 && response.status < 400) return problem("The Ads service returned an unexpected redirect. Refresh the record before retrying.", 502);
    if (response.status === 204) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    const text = await response.text();
    try { JSON.parse(text); } catch { return problem("The Ads service returned an unreadable response. Refresh the record before retrying.", 502); }
    return new Response(text, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return problem("The Ads service could not be reached. Refresh the record before retrying.", 502); }
}
