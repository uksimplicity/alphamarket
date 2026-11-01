import type { NextRequest } from "next/server";
import { productTypeResponseError } from "@/components/admin/productTypeResponse";

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
  const joinedPath = pathParts.map(encodeURIComponent).join("/");
  const productTypeRequest = pathParts[0] === "product-types";

  const accountMutation = method !== "GET" &&
    (joinedPath === "user" || /^users\/[^/]+\/status$/.test(joinedPath));
  const candidateUrls = productTypeRequest
    ? [`${API_ROOT_BASE}/api/v1/admin/${joinedPath}${search}`]
    : accountMutation || (joinedPath === "categories" && method === "POST")
    ? [`${API_BASE}/admin/${joinedPath}${search}`]
    : Array.from(
    new Set(
      API_BASE_CANDIDATES.flatMap((base) => [
        `${base}/admin/${joinedPath}${search}`,
        `${base}/${joinedPath}${search}`,
      ])
    )
  );

  let res: Response | null = null;
  const attempts: Array<{ url: string; status: number }> = [];

  for (const url of candidateUrls) {
    const attempt = await fetch(url, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
      ...(productTypeRequest ? { redirect: "manual" as const } : {}),
    });
    attempts.push({ url, status: attempt.status });
    if (attempt.status === 404 && !productTypeRequest) continue;
    res = attempt;
    break;
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
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  let text = await res.text();
  let productTypeUpstreamPath = `/api/v1/admin/${joinedPath}`;
  if (productTypeRequest && res.status >= 300 && res.status < 400) {
    return Response.json({ error: "The product type service redirected to an unexpected endpoint." }, { status: 502 });
  }
  if (productTypeRequest && res.ok && text.trim()) {
    let error: string | null;
    try { error = productTypeResponseError(JSON.parse(text)); }
    catch { error = "The product type service returned an unreadable response."; }
    // The seller catalog is also a documented read-only source of product types.
    // Do not replay creates/updates/deletes, or retry authorization failures.
    if (error && method === "GET" && pathParts.length === 1) {
      try {
        const fallback = await fetch(`${API_ROOT_BASE}/api/v1/seller/product-types${search}`, {
          method: "GET", headers, cache: "no-store", redirect: "manual",
          signal: AbortSignal.timeout(15_000),
        });
        const fallbackText = await fallback.text();
        if (fallback.ok && !productTypeResponseError(JSON.parse(fallbackText))) {
          res = fallback;
          text = fallbackText;
          error = null;
          productTypeUpstreamPath = "/api/v1/seller/product-types";
        }
      } catch { /* Keep the original, actionable service error. */ }
    }
    if (error) return Response.json({ error }, { status: 502, headers: {
      "Cache-Control": "no-store", "X-Admin-Upstream-Path": `/api/v1/admin/${joinedPath}`,
    } });
  }
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
  return new Response(res.status === 204 || res.status === 205 ? null : text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/json",
      ...(productTypeRequest ? { "Cache-Control": "no-store", "X-Admin-Upstream-Path": productTypeUpstreamPath } : {}),
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
