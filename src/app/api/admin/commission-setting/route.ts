const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
const json = (data: unknown) => Response.json(data, { headers: { "Cache-Control": "no-store" } });
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  if (!/^Bearer \S+$/i.test(authorization) || authorization.length > 8192) return fail("Please sign in as an admin.", 401);
  const key = process.env.ADMIN_COMMISSION_SETTING_KEY || "commission_percentage";
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key)) return fail("Commission settings are unavailable.", 503);
  let base: URL;
  try {
    base = new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "");
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash || !["", "/api/v1"].includes(base.pathname.replace(/\/+$/, ""))) throw new Error();
    base.pathname = "/api/v1/";
  } catch { return fail("Commission settings are unavailable.", 503); }
  let body: string | undefined;
  let path = "admin/platform-settings/all";
  if (req.method === "PUT") {
    const adminId = new URL(req.url).searchParams.get("admin_id") || "";
    if (!/^[a-zA-Z0-9-]{1,100}$/.test(adminId)) return fail("Your admin account ID is required.", 400);
    let input: { percentage?: unknown };
    try { input = await req.json(); } catch { return fail("Enter a valid percentage.", 400); }
    const percentage = input?.percentage;
    if (typeof percentage !== "number" || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) return fail("Enter a percentage from 0 to 100.", 400);
    path = "admin/platform-settings/upsert?admin_id=" + encodeURIComponent(adminId);
    body = JSON.stringify({ key, value: String(percentage), description: "Admin-defined commission percentage; 10 means 10%." });
  }
  try {
    const response = await fetch(base.href + path, { method: req.method, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { Authorization: authorization, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body });
    if (response.status >= 300 && response.status < 400) return fail("The settings service returned an unexpected redirect.", 502);
    const payload = await response.json();
    if (!response.ok || payload?.success === false) return fail(typeof payload?.error === "string" ? payload.error : "The settings request failed.", response.ok ? 502 : response.status);
    if (req.method === "PUT") return json({ success: true });
    const data = payload?.data ?? payload;
    const rows = Array.isArray(data) ? data : data?.settings;
    if (!Array.isArray(rows)) return fail("The settings service returned an unreadable list.", 502);
    const matches = rows.filter(row => row && row.key === key);
    if (!matches.length) return json({ percentage: null });
    if (matches.length > 1) return fail("The settings service returned duplicate commission settings.", 502);
    const raw = matches[0].value;
    const percentage = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(raw.trim()) ? Number(raw) : NaN;
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return fail("The saved percentage could not be read. Check the platform setting.", 502);
    return json({ percentage });
  } catch { return fail(req.method === "PUT" ? "The save result could not be confirmed. Refresh the saved percentage before trying again." : "Commission settings could not be loaded.", 502); }
}
export const GET = handle;
export const PUT = handle;
