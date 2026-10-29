const RAW_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_BASE = RAW_BASE.endsWith("/api/v1") ? RAW_BASE : `${RAW_BASE}/api/v1`;

async function forward(req: Request, path: string[], method: "GET" | "POST") {
  const valid = method === "GET" ? path.length === 1 && ["pending", "timed-out"].includes(path[0])
    : path.length === 2 && Boolean(path[0]?.trim()) && ![".", ".."].includes(path[0]) && !/[\/\\\u0000-\u001f]/.test(path[0]) && ["release", "reverse"].includes(path[1]);
  if (!valid) return Response.json({ error: "Unknown escrow operation." }, { status: 400 });
  if (!RAW_BASE) return Response.json({ error: "The escrow backend is not configured." }, { status: 503 });
  const authorization = (req.headers.get("authorization") ?? "").trim().replace(/^Bearer\s+Bearer\s+/i, "Bearer ");
  const cookie = req.headers.get("cookie") ?? "";
  if (!authorization && !cookie) return Response.json({ error: "Sign in with an authorized admin account." }, { status: 401 });
  const headers: Record<string, string> = { Accept: "application/json", ...(authorization ? { Authorization: authorization } : {}), ...(cookie ? { Cookie: cookie } : {}) };
  let body: string | undefined;
  let search = "";
  if (method === "POST") {
    let payload: unknown;
    try { const text = await req.text(); payload = text ? JSON.parse(text) : {}; }
    catch { return Response.json({ error: "The escrow action must contain valid JSON." }, { status: 400 }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return Response.json({ error: "Invalid escrow action." }, { status: 400 });
    const notes = (payload as Record<string, unknown>).notes;
    if (notes !== undefined && typeof notes !== "string") return Response.json({ error: "Notes must be text." }, { status: 400 });
    if (path[1] === "reverse" && !(typeof notes === "string" && notes.trim())) return Response.json({ error: "Reversal notes are required." }, { status: 400 });
    body = JSON.stringify(typeof notes === "string" && notes.trim() ? { notes: notes.trim() } : {});
    headers["Content-Type"] = "application/json";
  } else {
    const query = new URL(req.url).searchParams;
    const limit = query.get("limit") ?? "50", offset = query.get("offset") ?? "0";
    if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 200 || !/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))) return Response.json({ error: "Invalid escrow pagination." }, { status: 400 });
    search = `?${new URLSearchParams({ limit, offset })}`;
  }
  try {
    // Use the documented admin endpoint exactly once. A lost response must not replay a financial action.
    const response = await fetch(`${API_BASE}/admin/escrows/${path.map(encodeURIComponent).join("/")}${search}`, {
      method, headers, body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 300 && response.status < 400) return Response.json({ error: "The escrow service returned an unexpected redirect. Refresh the escrow status." }, { status: 502 });
    return new Response(response.status === 204 ? null : await response.text(), {
      status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: method === "POST" ? "The action result could not be confirmed. Refresh the escrow queue before trying again." : "Could not reach the escrow service. Please try again." }, { status: 502 });
  }
}
type Context = { params: Promise<{ path: string[] }> };
export async function GET(req: Request, context: Context) { return forward(req, (await context.params).path ?? [], "GET"); }
export async function POST(req: Request, context: Context) { return forward(req, (await context.params).path ?? [], "POST"); }
