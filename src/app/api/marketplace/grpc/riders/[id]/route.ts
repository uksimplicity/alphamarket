export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const rawBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const fail = (error: string, status = 502) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!rawBase) return fail("The rider service is not configured.", 503);
  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) return fail("Sign in to view rider details.", 401);
  const { id } = await context.params;
  const base = rawBase.endsWith("/api/v1") ? rawBase : `${rawBase}/api/v1`;
  try {
    const response = await fetch(`${base}/marketplace/grpc/riders/${encodeURIComponent(id)}`, {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 300 && response.status < 400) return fail("The rider service returned an unexpected redirect.");
    const text = await response.text();
    try { JSON.parse(text); } catch { return fail("The rider service returned an unreadable response."); }
    return new Response(text, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return fail("The rider service could not be reached. Retry rider details shortly.");
  }
}
