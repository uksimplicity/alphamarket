import { NextResponse } from "next/server";

type PingRequest = {
  path?: string;
  method?: string;
  body?: unknown;
};

async function handlePing(req: Request, payload?: PingRequest) {
  const url = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

  if (!base) {
    return NextResponse.json(
      { ok: false, error: "NEXT_PUBLIC_API_BASE_URL is not set" },
      { status: 500 }
    );
  }

  const path =
    payload?.path ??
    url.searchParams.get("path") ??
    url.searchParams.get("p") ??
    "";
  const method = (payload?.method ?? "GET").toUpperCase();

  const normalizedPath = path.trim();
  const target = normalizedPath
    ? `${base}${normalizedPath.startsWith("/") ? "" : "/"}${normalizedPath}`
    : base;

  try {
    const res = await fetch(target, {
      method,
      headers: payload?.body
        ? { "Content-Type": "application/json" }
        : undefined,
      body:
        payload?.body && method !== "GET" && method !== "HEAD"
          ? JSON.stringify(payload.body)
          : undefined,
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") ?? "";
    const text = await res.text();

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      url: target,
      method,
      contentType,
      sample: text.slice(0, 300),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        url: target,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handlePing(req);
}

export async function POST(req: Request) {
  const payload = (await req.json()) as PingRequest;
  return handlePing(req, payload);
}
