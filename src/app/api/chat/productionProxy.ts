type Context = { params: Promise<{ path: string[] }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const error = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

async function forward(req: Request, context: Context) {
  const { path } = await context.params;
  const collection = path.length === 1 && path[0] === "conversations";
  const conversation = path.length >= 2 && path[0] === "conversations" && /^[a-zA-Z0-9-]{1,100}$/.test(path[1]);
  const detail = conversation && path.length === 2;
  const messages = conversation && path.length === 3 && path[2] === "messages";
  const read = conversation && path.length === 3 && path[2] === "read";
  const categories = path.length === 1 && path[0] === "categories";
  if (!(req.method === "GET" && (collection || detail || messages || categories)
    || req.method === "POST" && (collection || messages || read))) return error("Message endpoint not found.", 404);

  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer \S+$/i.test(authorization) || authorization.length > 8192) return error("Please sign in to use Messages.", 401);
  let base: URL;
  try {
    base = new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "");
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error();
    const pathname = base.pathname.replace(/\/+$/, "");
    if (pathname !== "" && pathname !== "/api/v1") throw new Error();
    base.pathname = "/api/v1/";
  } catch { return error("Messages are unavailable. Please try again later.", 503); }

  const query = new URLSearchParams();
  const inputQuery = new URL(req.url).searchParams;
  if (req.method === "GET" && (collection || messages)) {
    const limit = inputQuery.get("limit") || (messages ? "30" : "20");
    if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100) return error("Invalid page size.", 400);
    query.set("limit", limit);
    if (collection) {
      const offset = inputQuery.get("offset") || "0";
      if (!/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))) return error("Invalid conversation position.", 400);
      query.set("offset", offset);
      for (const [key, allowed] of [["type", ["product", "order", "delivery", "support"]], ["status", ["open", "closed"]]] as const) {
        const value = inputQuery.get(key);
        if (value && !allowed.some(item => item === value)) return error("Invalid conversation filter.", 400);
        if (value) query.set(key, value);
      }
    } else {
      const before = inputQuery.get("before");
      if (before) {
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(before) || !Number.isFinite(Date.parse(before))) return error("Invalid message position.", 400);
        query.set("before", before);
      }
    }
  }

  let body: string | undefined;
  if (req.method === "POST" && !read) {
    let input: Record<string, unknown>;
    try {
      const raw = await req.text();
      if (raw.length > 16384) return error("Message is too large.", 413);
      input = JSON.parse(raw);
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
    } catch { return error("A valid request is required.", 400); }
    if (collection) {
      if (!["product", "order", "delivery", "support"].includes(String(input.type))) return error("Choose a conversation type.", 400);
      if (input.type === "support" ? typeof input.category_id !== "string" || !input.category_id.trim() : typeof input.context_id !== "string" || !input.context_id.trim()) return error("Conversation context is required.", 400);
      if (input.context_type !== undefined && !["order", "delivery"].includes(String(input.context_type))) return error("Invalid support context.", 400);
      const payload: Record<string, string> = { type: String(input.type) };
      for (const key of ["context_id", "context_type", "category_id", "message", "attachment_url"]) {
        if (input[key] === undefined) continue;
        if (typeof input[key] !== "string" || input[key].length > (key === "message" ? 2000 : 2048)) return error("Invalid conversation details.", 400);
        payload[key] = input[key];
      }
      body = JSON.stringify(payload);
    } else {
      if (typeof input.body !== "string" || !input.body.trim() || input.body.length > 2000) return error("Enter a message of up to 2000 characters.", 400);
      body = JSON.stringify({ body: input.body.trim() });
    }
  }

  const upstream = categories ? "chat-categories" : "chat/" + path.map(encodeURIComponent).join("/");
  try {
    const response = await fetch(base.href + upstream + (query.size ? "?" + query : ""), {
      method: req.method, body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { Authorization: authorization, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    });
    if (response.status >= 300 && response.status < 400) return error("The message server returned an unexpected redirect.", 502);
    const payload = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
    return Response.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch { return error("The message result could not be confirmed. Refresh the conversation before sending again.", 502); }
}
export const GET = forward;
export const POST = forward;
