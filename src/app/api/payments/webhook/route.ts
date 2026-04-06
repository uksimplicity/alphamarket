const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

export async function POST(req: Request) {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  const eventHeader = req.headers.get("x-paystack-event") ?? "";
  const contentType = req.headers.get("content-type") ?? "application/json";

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": contentType,
    ...(signature ? { "x-paystack-signature": signature } : {}),
    ...(eventHeader ? { "x-paystack-event": eventHeader } : {}),
  };

  const urls = Array.from(new Set([`${API_V1_BASE}/payments/webhook`, `${API_BASE}/payments/webhook`]));

  let res: Response | null = null;
  for (const target of urls) {
    const candidate = await fetch(target, {
      method: "POST",
      headers,
      body: body || undefined,
      cache: "no-store",
    });
    if (candidate.status === 404) continue;
    res = candidate;
    break;
  }

  if (!res) {
    return new Response(
      JSON.stringify({ error: "Payments webhook endpoint not found on upstream.", tried: urls }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
