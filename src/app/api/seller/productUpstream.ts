// Seller writes are sent once to the documented route. The backend enforces ownership.
export function problem(error: string, status = 400) {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export function sellerAccess(req: Request): Response | { base: string; headers: Record<string, string> } {
  const authorization = req.headers.get("authorization")?.trim() ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return problem("Sign in to continue.", 401);
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!raw) return problem("Marketplace service is unavailable.", 503);
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error();
    return { base: raw.endsWith("/api/v1") ? raw : `${raw}/api/v1`, headers: { Authorization: authorization, Accept: "application/json" } };
  } catch { return problem("Marketplace service is unavailable.", 503); }
}

export async function sellerRequest(req: Request, path: string, method = "GET", body?: Record<string, unknown> | FormData) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  const multipart = body instanceof FormData;
  try {
    const upstream = await fetch(`${access.base}${path}`, {
      method, headers: { ...access.headers, ...(body && !multipart ? { "Content-Type": "application/json" } : {}) },
      body: body ? multipart ? body : JSON.stringify(body) : undefined,
      redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) return problem("Marketplace returned an unexpected redirect. Check the current product before trying again.", 502);
    if (upstream.status === 204) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    const text = await upstream.text();
    try { JSON.parse(text); } catch { return problem("Marketplace returned an unreadable response. Check the current product before trying again.", 502); }
    return new Response(text, { status: upstream.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return problem("Marketplace could not be reached. Check the current product before trying again.", 502); }
}

export async function productBody(req: Request) {
  try {
    const body: unknown = await req.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch { return null; }
}

export function invalidProduct(body: Record<string, unknown>, creating = false) {
  if (body.status === "draft" && body.isPublished === true) return "A draft cannot be published.";
  if ((creating || "name" in body) && (typeof body.name !== "string" || !body.name.trim())) return "Product name is required.";
  if (creating && (typeof body.categoryId !== "string" || !body.categoryId.trim())) return "Category is required.";
  if (creating && (typeof body.productTypeId !== "string" || !body.productTypeId.trim())) return "Product type is required.";
  if (creating) {
    if (typeof body.location !== "string" || !body.location.trim()) return "Product location is required.";
    if (typeof body.shortDescription !== "string" || !body.shortDescription.trim()) return "Product description is required.";
    const media = body.media && typeof body.media === "object" && !Array.isArray(body.media) ? body.media as Record<string, unknown> : {};
    const hasCover = typeof media.cover === "string" && Boolean(media.cover.trim());
    const hasProductPhoto = Array.isArray(media.images) && media.images.some((item) => typeof item === "string" && item.trim());
    if (!hasCover && !hasProductPhoto) return "Add at least one product image.";
  }
  if (creating || "basePrice" in body) {
    const price = body.basePrice;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 1e9) return "Price must be greater than zero and at most 1,000,000,000.";
  }
  if ("stock" in body && (typeof body.stock !== "number" || !Number.isInteger(body.stock) || body.stock < 0 || body.stock > 1e6)) return "Stock must be a whole number between zero and 1,000,000.";
  if (creating && "discounts" in body) {
    if (!Array.isArray(body.discounts)) return "Discounts must be a list.";
    for (const entry of body.discounts) {
      if (!entry || typeof entry !== "object") return "Invalid discount.";
      const discount = entry as Record<string, unknown>;
      if (typeof discount.price !== "number" || !Number.isFinite(discount.price) || discount.price <= 0 || discount.price > 1e9) return "Discount price must be greater than zero and at most 1,000,000,000.";
      if (typeof body.basePrice === "number" && discount.price >= body.basePrice) return "Discount price must be less than the base price.";
      const start = typeof discount.startDate === "string" ? Date.parse(discount.startDate) : NaN;
      const end = typeof discount.endDate === "string" ? Date.parse(discount.endDate) : NaN;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return "Discount end date must be on or after the start date.";
    }
  }
  return null;
}

export function productRows(payload: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(payload)) return payload.filter(row => row && typeof row === "object" && !Array.isArray(row));
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["products", "items", "rows", "data"]) {
    if (key in record) { const rows = productRows(record[key]); if (rows) return rows; }
  }
  return null;
}
