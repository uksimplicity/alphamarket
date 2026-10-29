const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("reference")?.trim();
  if (!reference || reference.length > 200) return Response.json({ error: "A valid payment reference is required." }, { status: 400 });
  if (!API_BASE) return Response.json({ error: "Payment backend is not configured." }, { status: 503 });
  const query = new URLSearchParams({ reference });
  try {
    for (const base of new Set([API_V1_BASE, API_BASE])) {
      const response = await fetch(`${base}/payments/callback?${query}`, {
        cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000),
        headers: { Accept: "application/json" },
      });
      if (response.status === 404) continue;
      if (response.ok || [301, 302, 303, 307, 308].includes(response.status)) {
        // A callback redirect is not proof of payment. The UI reads the order's payment status.
        return Response.json({ verification_requested: true }, { headers: { "Cache-Control": "no-store" } });
      }
      const text = await response.text();
      let message = "The backend could not verify this payment. Check the order status before paying again.";
      try { const payload = JSON.parse(text); message = payload.error || payload.message || message; } catch { /* Keep a readable error for non-JSON upstream responses. */ }
      return Response.json({ error: message }, { status: response.status });
    }
    return Response.json({ error: "The backend payment callback endpoint was not found." }, { status: 502 });
  } catch {
    return Response.json({ error: "Payment verification is unavailable. Please check again shortly." }, { status: 502 });
  }
}
