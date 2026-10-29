const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;
type Context = { params: Promise<{ path: string[] }> };
const invalid = (error: string) => Response.json({ error }, { status: 400 });

async function forward(req: Request, context: Context) {
  const { path } = await context.params;
  if (path.some(part => !part || part === "." || part === ".." || /[/\\\x00-\x1f\x7f]/.test(part))) return invalid("Invalid payout path.");
  const route = path.join("/");
  const method = req.method;
  const list = route === "withdrawals";
  const detail = path.length === 2 && path[0] === "withdrawals";
  const cancel = path.length === 3 && path[0] === "withdrawals" && path[2] === "cancel";
  const allowed = method === "GET" && (["account", "banks", "resolve", "summary", "withdrawals"].includes(route) || detail)
    || method === "PUT" && route === "account"
    || method === "POST" && (list || cancel);
  if (!allowed) return Response.json({ error: "Payout endpoint not found." }, { status: 404 });
  const authorization = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  if (!authorization && !cookie) return Response.json({ error: "Please sign in to manage your payouts." }, { status: 401 });
  if (!API_BASE) return Response.json({ error: "Payout backend is not configured." }, { status: 503 });
  const query = new URLSearchParams();
  const incoming = new URL(req.url).searchParams;
  let body: string | undefined;
  if (method === "GET" && route === "resolve") {
    const number = incoming.get("account_number") ?? "";
    const bank = incoming.get("bank_code")?.trim() ?? "";
    if (!/^\d{10}$/.test(number) || !bank || bank.length > 80) return invalid("Select a bank and enter a 10-digit account number.");
    query.set("account_number", number); query.set("bank_code", bank);
  }
  if (method === "GET" && list) {
    for (const [key, fallback, minimum, maximum] of [["limit", 20, 1, 200], ["offset", 0, 0, Number.MAX_SAFE_INTEGER]] as const) {
      const raw = incoming.get(key) ?? String(fallback);
      const value = Number(raw);
      if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum || value > maximum) return invalid(`Invalid ${key}.`);
      query.set(key, String(value));
    }
  }
  if (method === "PUT" || method === "POST" && list) {
    let input: Record<string, unknown>;
    try { input = await req.json(); } catch { return invalid("A JSON request is required."); }
    if (!input || typeof input !== "object" || Array.isArray(input)) return invalid("Invalid request.");
    if (method === "PUT") {
      const bank = typeof input.bank_code === "string" ? input.bank_code.trim() : "";
      if (typeof input.account_number !== "string" || !/^\d{10}$/.test(input.account_number) || !bank || bank.length > 80) return invalid("Select a bank and enter a 10-digit account number.");
      body = JSON.stringify({ account_number: input.account_number, bank_code: bank });
    } else {
      const amount = input.amount;
      if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100)) || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) return invalid("Enter a positive naira amount with up to two decimal places.");
      body = JSON.stringify({ amount });
    }
  }
  try {
    // Never retry a withdrawal, bank update or cancellation at another URL.
    const response = await fetch(`${API_V1_BASE}/payouts/${path.map(encodeURIComponent).join("/")}${query.size ? `?${query}` : ""}`, {
      method, body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000),
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...(authorization ? { Authorization: authorization } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    });
    if (response.status >= 300 && response.status < 400) return Response.json({ error: "Unexpected payout service redirect. Refresh your account and withdrawal history before trying again." }, { status: 502 });
    const text = await response.text();
    return new Response(response.status === 204 ? null : text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: method === "GET" ? "Payout information is temporarily unavailable. Please refresh." : "The payout response could not be confirmed. Refresh your account and withdrawal history before trying again." }, { status: 502 });
  }
}

export const GET = forward;
export const PUT = forward;
export const POST = forward;
