const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const API = BASE.endsWith("/api/v1") ? BASE : `${BASE}/api/v1`;
export async function GET(req: Request) {
  if (!BASE) return Response.json({ error: "The marketplace is temporarily unavailable." }, { status: 503 });
  const incoming = new URL(req.url).searchParams;
  const query = new URLSearchParams();
  for (const [key, fallback, minimum, maximum] of [["limit", 100, 1, 100], ["offset", 0, 0, Number.MAX_SAFE_INTEGER]] as const) {
    const raw = incoming.get(key) ?? String(fallback), value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum || value > maximum) return Response.json({ error: `Invalid ${key}.` }, { status: 400 });
    query.set(key, String(value));
  }
  const search = incoming.get("search")?.trim();
  if (search) query.set("search", search.slice(0, 200));
  try {
    const response = await fetch(`${API}/products/public?${query}`, { cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15000), headers: { Accept: "application/json" } });
    if (response.status >= 300 && response.status < 400) return Response.json({ error: "Products are temporarily unavailable." }, { status: 502 });
    return new Response(response.status === 204 ? null : await response.text(), { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Products could not be loaded. Please try again." }, { status: 502 }); }
}
