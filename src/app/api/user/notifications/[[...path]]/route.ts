type Context = { params: Promise<{ path?: string[] }> };
const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

async function handle(req: Request, context: Context) {
  const authorization = req.headers.get("authorization")?.trim() || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return fail("Sign in to view notifications.", 401);
  const { path = [] } = await context.params;
  let method: string;
  if (!path.length || (path.length === 1 && path[0] === "unread-count")) method = "GET";
  else if (path.length === 1 && path[0] === "read-all") method = "POST";
  else if (path.length === 1) method = "DELETE";
  else if (path.length === 2 && path[1] === "read") method = "PATCH";
  else return fail("Notification route not found.", 404);
  if (req.method !== method) return fail("Method not allowed.", 405);
  if (path.some(part => !part.trim() || /[\\/?#\u0000-\u001f]/.test(part))) return fail("Invalid notification ID.", 400);
  const query = new URLSearchParams();
  if (!path.length) {
    const params = new URL(req.url).searchParams;
    for (const [name, fallback, max] of [["limit", 20, 100], ["offset", 0, 1e7]] as const) {
      const value = params.has(name) ? Number(params.get(name)) : fallback;
      if (!Number.isSafeInteger(value) || value < (name === "limit" ? 1 : 0) || value > max) return fail("Invalid pagination.", 400);
      query.set(name, String(value));
    }
    if (params.has("is_read")) {
      const value = params.get("is_read")!;
      if (!["true", "false"].includes(value)) return fail("Invalid read filter.", 400);
      query.set("is_read", value);
    }
    if (params.get("type")) {
      const type = params.get("type")!;
      if (type.length > 100 || /[\u0000-\u001f]/.test(type)) return fail("Invalid notification type.", 400);
      query.set("type", type);
    }
  }
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!raw) return fail("Notification service is unavailable.", 503);
  try {
    const base = new URL(raw);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) return fail("Notification service is unavailable.", 503);
    const root = raw.endsWith("/api/v1") ? raw : `${raw}/api/v1`;
    const suffix = path.length ? `/${path.map(encodeURIComponent).join("/")}` : `?${query}`;
    const response = await fetch(`${root}/user/notifications${suffix}`, {
      method, headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store", redirect: "manual", signal: AbortSignal.any([req.signal, AbortSignal.timeout(15000)]),
    });
    if (response.status >= 300 && response.status < 400) return fail("The notification service returned an unexpected redirect. Refresh before retrying.", 502);
    if (response.status === 204) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    const text = await response.text();
    try { JSON.parse(text); } catch { return fail("The notification service returned an unreadable response. Please refresh.", 502); }
    return new Response(text, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch { return fail("Could not reach notifications. Refresh before retrying.", 502); }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
