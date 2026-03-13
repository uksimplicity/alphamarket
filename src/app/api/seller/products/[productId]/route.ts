import type { NextRequest } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

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
  const primaryUrl = `${API_BASE}/seller/products/${safeId}${search}`;
  const fallbackUrl = `${API_BASE}/auth/seller/products/${safeId}${search}`;

  let res = await fetch(primaryUrl, {
    method,
    headers,
    body: body || undefined,
    cache: "no-store",
  });

  if (res.status === 404) {
    res = await fetch(fallbackUrl, {
      method,
      headers,
      body: body || undefined,
      cache: "no-store",
    });
  }

  if (res.status === 404) {
    return new Response(
      JSON.stringify({
        error: "Upstream endpoint not found.",
        tried: [primaryUrl, fallbackUrl],
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
