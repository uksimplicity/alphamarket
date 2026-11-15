export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const rawBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const fail = (error: string, status = 502) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!rawBase) return fail("The rider verification service is not configured.", 503);
  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return fail("Sign in to verify riders.", 401);
  const { id } = await context.params;
  const base = rawBase.endsWith("/api/v1") ? rawBase : `${rawBase}/api/v1`;
  try {
    // Verification is sent once; never retry a write at guessed fallback URLs.
    const response = await fetch(`${base}/admin/riders/${encodeURIComponent(id)}/verify`, {
      method: "POST", headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 300 && response.status < 400) return fail("Verification returned an unexpected redirect. Refresh the queue before trying again.");
    if (response.status === 204) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    const text = await response.text();
    try { JSON.parse(text); } catch { return fail("Verification returned an unreadable response. Refresh the queue before trying again."); }
    return new Response(text, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return fail("The verification result could not be confirmed. Refresh the queue before trying again.");
  }
}
