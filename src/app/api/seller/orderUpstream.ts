import { sellerAccess } from "./productUpstream";

export async function orderRequest(req: Request, path: string) {
  const access = sellerAccess(req);
  if (access instanceof Response) return access;
  const fail = (error: string) => Response.json({ error }, { status: 502, headers: { "Cache-Control": "no-store" } });
  try {
    const response = await fetch(`${access.base}${path}`, {
      headers: access.headers, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000),
    });
    if (response.status >= 300 && response.status < 400) return fail("The orders service returned an unexpected redirect. Please refresh.");
    const body = await response.text();
    try { JSON.parse(body); } catch { return fail("The orders service returned an unreadable response. Please refresh."); }
    return new Response(body, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  } catch {
    return fail("Orders could not be loaded. Please refresh or try again shortly.");
  }
}
