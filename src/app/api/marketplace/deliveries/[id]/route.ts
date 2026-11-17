export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const fail = (error: string, status = 502) => Response.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } });
  const rawBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  if (!rawBase) return fail("The delivery service is not configured.", 503);
  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return fail("Sign in to view delivery tracking.", 401);
  const { id } = await context.params;
  const base = rawBase.endsWith("/api/v1") ? rawBase : `${rawBase}/api/v1`;
  try {
    const response = await fetch(`${base}/rider-app/deliveries/${encodeURIComponent(id)}`, {
      headers: { Authorization: authorization, Accept: "application/json" }, cache: "no-store",
      redirect: "manual", signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 300 && response.status < 400) return fail("The delivery service returned an unexpected redirect.");
    const text = await response.text();
    try { JSON.parse(text); } catch { return fail("The delivery service returned an unreadable response."); }
    if ([401, 403, 404].includes(response.status)) return fail("Delivery tracking is unavailable to this account. The delivery service did not grant access to this delivery.", response.status);
    return new Response(text, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return fail("The delivery service could not be reached. Refresh tracking to try again.");
  }
}
