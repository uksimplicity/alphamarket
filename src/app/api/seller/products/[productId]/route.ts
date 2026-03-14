import type { NextRequest } from "next/server";

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_V1_BASE = API_BASE.endsWith("/api/v1") ? API_BASE : `${API_BASE}/api/v1`;

async function proxySellerProduct(
  req: Request,
  productId: string,
  method: "GET" | "PUT" | "PATCH" | "DELETE"
) {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const { search } = new URL(req.url);
  const authHeader = req.headers.get("authorization") ?? "";
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
  };

  const hasBody = method !== "GET" && method !== "DELETE";
  const body = hasBody ? await req.text() : "";
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const safeId = encodeURIComponent(productId);
  const urls = Array.from(
    new Set([
      `${API_V1_BASE}/seller/products/${safeId}${search}`,
      `${API_BASE}/seller/products/${safeId}${search}`,
      `${API_BASE}/auth/seller/products/${safeId}${search}`,
    ])
  );

  try {
    let res: Response | null = null;
    let upstreamErrorRes: Response | null = null;
    const attempts: Array<{ url: string; status: number }> = [];

    for (const url of urls) {
      res = await fetch(url, {
        method,
        headers,
        body: body || undefined,
        cache: "no-store",
      });
      attempts.push({ url, status: res.status });
      if (res.status === 404) continue;
      if (res.status >= 500) {
        upstreamErrorRes = res;
        continue;
      }
      break;
    }

    if ((!res || res.status === 404) && !upstreamErrorRes) {
      return new Response(
        JSON.stringify({
          error: "Upstream endpoint not found.",
          tried: urls,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const finalRes = upstreamErrorRes ?? res;
    if (!finalRes) {
      return new Response(
        JSON.stringify({
          error: "Seller product proxy had no upstream response.",
          tried: urls,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const text = await finalRes.text();
    if (finalRes.status >= 500) {
      console.error("Seller product upstream 5xx", {
        status: finalRes.status,
        productId,
        tried: urls,
        attempts,
        bodyPreview: text.slice(0, 400),
      });
    }

    return new Response(text, {
      status: finalRes.status,
      headers: {
        "Content-Type": finalRes.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to reach seller product upstream.",
        details: error instanceof Error ? error.message : "Unknown fetch error",
        tried: urls,
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;
  return proxySellerProduct(req, productId, "GET");
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;
  return proxySellerProduct(req, productId, "PUT");
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;
  return proxySellerProduct(req, productId, "PATCH");
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ productId: string }> }
) {
  const { productId } = await context.params;
  return proxySellerProduct(req, productId, "DELETE");
}
