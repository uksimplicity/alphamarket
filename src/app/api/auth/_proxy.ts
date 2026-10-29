const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

export async function proxyAuthRequest(
  path: string,
  req: Request
): Promise<Response> {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.text();
  const targets = Array.from(new Set([`${API_V1_BASE}${path}`, `${API_BASE}${path}`]));
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(15_000)]);

  try {
    let res: Response | null = null;
    for (const target of targets) {
      const candidate = await fetch(target, {
        method: req.method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body || undefined,
        cache: "no-store",
        signal,
      });
      if (candidate.status === 404) {
        continue;
      }
      res = candidate;
      break;
    }

    if (!res) {
      return new Response(
        JSON.stringify({ error: "Auth endpoint not found on upstream.", tried: targets }),
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
  } catch (error) {
    const timedOut = signal.aborted || (error instanceof Error && error.name === "TimeoutError");
    return Response.json(
      { error: timedOut ? "Authentication is taking too long. Please try again." : "Unable to reach the authentication service. Please try again." },
      { status: timedOut ? 504 : 502 }
    );
  }
}
