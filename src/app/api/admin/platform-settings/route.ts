export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const headers = { "Cache-Control": "no-store" };
  const fail = (error: string, status: number) => Response.json({ error }, { status, headers });
  if (!/^Bearer \S+$/i.test(authorization)) return fail("Please sign in as an admin.", 401);
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return fail("Platform settings are not configured.", 503);
  const root = base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  let body: string | undefined;
  if (req.method === "PUT") {
    try {
      const input = await req.json();
      if (!input || typeof input.key !== "string" || !/^[\w.-]{1,100}$/.test(input.key) || typeof input.value !== "string" || !input.value.trim() || input.value.length > 200) return fail("A setting and value are required.", 400);
      body = JSON.stringify({ key: input.key, value: input.value });
    } catch { return fail("A valid setting is required.", 400); }
  }
  try {
    const upstream = await fetch(`${root}/admin/platform-settings/${body ? "upsert" : "all"}`, {
      method: req.method, headers: { Authorization: authorization, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
      body, cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(20000),
    });
    if (upstream.status >= 300 && upstream.status < 400) return fail("The settings service returned an unexpected redirect. Refresh before trying again.", 502);
    const payload = await upstream.json();
    if (!upstream.ok || payload?.success === false) return fail(typeof payload?.error === "string" ? payload.error : typeof payload?.message === "string" ? payload.message : "The settings request failed.", upstream.ok ? 502 : upstream.status);
    return Response.json(payload, { headers });
  } catch { return fail(req.method === "PUT" ? "The save result could not be confirmed. Refresh saved values before trying again." : "Platform settings could not be loaded.", 502); }
}

export const GET = handle;
export const PUT = handle;
