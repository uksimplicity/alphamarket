export async function POST(req: Request) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  if (!apiBase) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const formData = await req.formData();
  const authHeader = req.headers.get("authorization") ?? "";

  const res = await fetch(`${apiBase}/upload/file`, {
    method: "POST",
    headers: {
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: formData,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}
