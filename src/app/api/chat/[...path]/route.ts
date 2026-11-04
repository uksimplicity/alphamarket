import { GET as productionGET, POST as productionPOST } from "../productionProxy";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };

// Preserve the read-only name lookup used by catalog cards independently of messaging.
export async function GET(req: Request, context: Context) {
  const { path } = await context.params;
  if (path.length !== 1 || path[0] !== "sellers") return productionGET(req, context);
  const fail = (status: number) => Response.json({ error: "Seller directory unavailable." }, { status, headers: { "Cache-Control": "no-store" } });
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer \S+$/i.test(authorization) || authorization.length > 8192) return fail(401);
  let base: URL;
  try {
    base = new URL(process.env.CHAT_SERVER_URL || "");
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error();
  } catch { return fail(503); }
  try {
    const response = await fetch(base.origin + "/v1/sellers", { headers: { Authorization: authorization, Accept: "application/json" }, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(15000) });
    if (response.status >= 300 && response.status < 400) return fail(502);
    return Response.json(await response.json(), { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch { return fail(502); }
}
export const POST = productionPOST;
