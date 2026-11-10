export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
  const json = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  if (!base) return json("Product cities are not configured.", 503);
  const offset = new URL(req.url).searchParams.get("offset") || "0";
  if (!/^\d+$/.test(offset) || !Number.isSafeInteger(Number(offset))) return json("Invalid city pagination.", 400);
  const root = base.endsWith("/api/v1") ? base : `${base}/api/v1`;
  try {
    const response = await fetch(`${root}/ads/locations?type=city&limit=100&offset=${Number(offset)}`, {
      cache: "no-store", redirect: "manual", signal: AbortSignal.any([req.signal, AbortSignal.timeout(15000)]), headers: { Accept: "application/json" },
    });
    if (!response.ok) return json("Product cities could not be loaded. Please retry.", response.status >= 300 && response.status < 400 ? 502 : response.status);
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch { return json("Product cities could not be loaded. Please retry.", 502); }
}
