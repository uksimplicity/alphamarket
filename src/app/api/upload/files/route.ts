const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

export async function GET(req: Request) {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const { search } = new URL(req.url);
  const targets = Array.from(
    new Set([`${API_V1_BASE}/upload/files${search}`, `${API_BASE}/upload/files${search}`])
  );

  let res: Response | null = null;
  for (const target of targets) {
    const attempt = await fetch(target, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      cache: "no-store",
    });
    if (attempt.status === 404) continue;
    res = attempt;
    break;
  }

  if (!res) {
    return new Response(
      JSON.stringify({ error: "Upload files endpoint not found on upstream.", tried: targets }),
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
