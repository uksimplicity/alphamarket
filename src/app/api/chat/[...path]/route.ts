type Context = { params: Promise<{ path: string[] }> };
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const error = (message: string, status: number) => Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
async function forward(req: Request, context: Context) {
  const { path } = await context.params;
  const route = path.join("/");
  const messages = path.length === 3 && path[0] === "conversations" && /^[a-zA-Z0-9-]{1,100}$/.test(path[1]) && path[2] === "messages";
  const allowed = req.method === "GET" && (["sellers", "conversations"].includes(route) || messages)
    || req.method === "POST" && (["session", "conversations"].includes(route) || messages);
  if (!allowed) return error("Message endpoint not found.", 404);
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer \S+$/i.test(authorization) || authorization.length > 8192) return error("Please sign in to use Messages.", 401);
  let base: URL;
  try {
    base = new URL(process.env.CHAT_SERVER_URL || "");
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error();
  } catch { return error("Messages are unavailable. Please try again later.", 503); }
  let body: string | undefined;
  const query = new URLSearchParams();
  if (messages && req.method === "GET") {
    const after = new URL(req.url).searchParams.get("after") || "0";
    if (!/^\d+$/.test(after) || !Number.isSafeInteger(Number(after))) return error("Invalid message position.", 400);
    query.set("after", after);
  }
  if (req.method === "POST") {
    let input: Record<string, unknown>;
    try { const raw = await req.text(); if (raw.length > 12288) return error("Message is too large.", 413); input = JSON.parse(raw); if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error(); }
    catch { return error("A valid request is required.", 400); }
    if (route === "session") body = "{}";
    else if (route === "conversations") {
      if (typeof input.seller_id !== "string" || !input.seller_id.trim() || input.seller_id.length > 200) return error("Choose an available seller.", 400);
      body = JSON.stringify({ seller_id: input.seller_id });
    } else {
      if (typeof input.client_id !== "string" || !/^[a-zA-Z0-9_-]{16,100}$/.test(input.client_id) || typeof input.text !== "string" || !input.text.trim() || input.text.length > 2000) return error("Enter a message of up to 2000 characters.", 400);
      body = JSON.stringify({ client_id: input.client_id, text: input.text });
    }
  }
  try {
    const response = await fetch(`${base.origin}/v1/${path.map(encodeURIComponent).join("/")}${query.size ? `?${query}` : ""}`, {
      method: req.method, body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { Authorization: authorization, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    });
    if (response.status >= 300 && response.status < 400) return error("The message server returned an unexpected redirect. Please retry.", 502);
    const payload = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
    return Response.json(payload, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch { return error("Messages could not be loaded or saved. Please retry.", 502); }
}
export const GET = forward;
export const POST = forward;
