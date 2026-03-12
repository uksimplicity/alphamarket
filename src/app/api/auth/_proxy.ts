const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

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
  const target = `${API_BASE}${path}`;

  const res = await fetch(target, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body || undefined,
    cache: "no-store",
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
