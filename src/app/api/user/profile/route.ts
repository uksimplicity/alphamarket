const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

async function proxyProfile(req: Request, method: "GET" | "PUT") {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
  };

  const body = method === "PUT" ? await req.text() : "";
  if (method === "PUT") {
    headers["Content-Type"] = "application/json";
  }

  const urls = Array.from(
    new Set([`${API_V1_BASE}/user/profile`, `${API_BASE}/user/profile`])
  );

  try {
    let res: Response | null = null;
    let upstreamErrorRes: Response | null = null;
    for (const candidate of urls) {
      res = await fetch(candidate, {
        method,
        headers,
        body: body || undefined,
        cache: "no-store",
      });
      if (res.status === 404) continue;
      if (res.status >= 500) {
        upstreamErrorRes = res;
        continue;
      }
      break;
    }

    if ((!res || res.status === 404) && !upstreamErrorRes) {
      return new Response(
        JSON.stringify({ error: "Upstream profile endpoint not found.", tried: urls }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const finalRes = upstreamErrorRes ?? res;
    if (!finalRes) {
      return new Response(
        JSON.stringify({ error: "Profile proxy had no upstream response." }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const text = await finalRes.text();
    return new Response(text, {
      status: finalRes.status,
      headers: {
        "Content-Type": finalRes.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to reach profile upstream.",
        details: error instanceof Error ? error.message : "Unknown fetch error",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET(req: Request) {
  return proxyProfile(req, "GET");
}

export async function PUT(req: Request) {
  return proxyProfile(req, "PUT");
}
