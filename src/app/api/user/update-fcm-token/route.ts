const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

export async function POST(req: Request) {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const body = await req.text();
  const targets = Array.from(
    new Set([`${API_V1_BASE}/user/update-fcm-token`, `${API_BASE}/user/update-fcm-token`])
  );

  let res: Response | null = null;
  for (const target of targets) {
    const attempt = await fetch(target, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: body || undefined,
      cache: "no-store",
    });
    if (attempt.status === 404) continue;
    res = attempt;
    break;
  }

  if (!res) {
    return new Response(
      JSON.stringify({
        error: "Update FCM token endpoint not found on upstream.",
        tried: targets,
      }),
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
