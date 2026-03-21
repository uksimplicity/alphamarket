import type { NextRequest } from "next/server";

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_ROOT_BASE = API_BASE.endsWith("/api/v1") ? API_BASE.slice(0, -"/api/v1".length) : API_BASE;
const API_BASE_CANDIDATES = Array.from(new Set([API_BASE, `${API_ROOT_BASE}/api/v1`, API_ROOT_BASE]));

function buildHeaders(req: NextRequest, hasBody: boolean) {
  const authHeader = req.headers.get("authorization") ?? "";
  const cookieHeader = req.headers.get("cookie") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function forwardRequest(
  req: NextRequest,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  pathParts: string[]
) {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { search } = new URL(req.url);
  const hasBody = method !== "GET" && method !== "DELETE";
  const body = hasBody ? await req.text() : "";
  const headers = buildHeaders(req, hasBody);
  const joinedPath = pathParts.join("/");

  const candidateUrls = Array.from(
    new Set(
      API_BASE_CANDIDATES.flatMap((base) => [
        `${base}/admin/${joinedPath}${search}`,
        `${base}/${joinedPath}${search}`,
      ])
    )
  );

  let res: Response | null = null;
  let upstreamErrorRes: Response | null = null;
  let upstreamErrorText = "";
  const attempts: Array<{ url: string; status: number }> = [];

  for (const url of candidateUrls) {
    const attempt = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });
    attempts.push({ url, status: attempt.status });
    if (attempt.status === 404) continue;
    if (attempt.status >= 500) {
      upstreamErrorRes = attempt;
      upstreamErrorText = await attempt.text();
      continue;
    }
    res = attempt;
    break;
  }

  if (!res) {
    res = upstreamErrorRes;
  }

  if ((!res || res.status === 404) && joinedPath === "dashboard") {
    const fallbackUrls = API_BASE_CANDIDATES.map(
      (base) => `${base}/admin/dashboard/stats${search}`
    );
    for (const fallbackUrl of fallbackUrls) {
      const attempt = await fetch(fallbackUrl, {
        method,
        headers,
        body: body || undefined,
        cache: "no-store",
      });
      if (attempt.status !== 404) {
        res = attempt;
        break;
      }
    }
  }

  if (!res) {
    return new Response(
      JSON.stringify({
        error: "Admin endpoint unavailable.",
        tried: attempts,
        details: upstreamErrorText.slice(0, 1000),
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const text = await res.text();
  if (res.status >= 500) {
    return new Response(
      JSON.stringify({
        error: `Admin request failed (${res.status}).`,
        tried: attempts,
        details: text.slice(0, 1000),
      }),
      { status: res.status, headers: { "Content-Type": "application/json" } }
    );
  }
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
    },
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forwardRequest(req, "GET", path ?? []);
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forwardRequest(req, "POST", path ?? []);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forwardRequest(req, "PUT", path ?? []);
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forwardRequest(req, "PATCH", path ?? []);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  return forwardRequest(req, "DELETE", path ?? []);
}
