import type { NextRequest } from "next/server";

const RAW_API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_ROOT_BASE = API_BASE.endsWith("/api/v1") ? API_BASE.slice(0, -"/api/v1".length) : API_BASE;
const API_BASE_CANDIDATES = Array.from(new Set([API_BASE, `${API_ROOT_BASE}/api/v1`, API_ROOT_BASE]));

function buildHeaders(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const cookieHeader = req.headers.get("cookie") ?? "";
  return {
    Accept: "application/json",
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };
}

function hasCategoryLikeRecords(payload: unknown): boolean {
  const visited = new WeakSet<object>();

  function walk(value: unknown): boolean {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (walk(item)) return true;
      }
      return false;
    }
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    if (visited.has(record)) return false;
    visited.add(record);

    const hasId =
      typeof record.id === "string" ||
      typeof record.id === "number" ||
      typeof record.uuid === "string" ||
      typeof record.category_id === "string" ||
      typeof record.category_id === "number" ||
      typeof record.categoryId === "string" ||
      typeof record.categoryId === "number";
    const hasName =
      typeof record.name === "string" ||
      typeof record.title === "string" ||
      typeof record.category_name === "string" ||
      typeof record.categoryName === "string";
    if (hasId && hasName) return true;

    return Object.values(record).some((nested) => walk(nested));
  }

  return walk(payload);
}

function normalizeCategories(payload: unknown) {
  const found: Array<{ id: string; name: string; createdBy: string; date: string }> = [];
  const visited = new WeakSet<object>();

  function walk(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    if (visited.has(record)) return;
    visited.add(record);

    const id = String(
      record.id ?? record.uuid ?? record.category_id ?? record.categoryId ?? ""
    ).trim();
    const name = String(
      record.name ?? record.title ?? record.category_name ?? record.categoryName ?? ""
    ).trim();
    if (id && name) {
      found.push({
        id,
        name,
        createdBy: String(record.created_by ?? record.createdBy ?? "Admin"),
        date: String(record.created_at ?? record.date ?? ""),
      });
    }

    Object.values(record).forEach(walk);
  }

  walk(payload);
  const deduped = new Map<string, { id: string; name: string; createdBy: string; date: string }>();
  for (const item of found) {
    const key = `${item.id}:${item.name.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, item);
  }
  return Array.from(deduped.values());
}

export async function GET(req: NextRequest) {
  if (!API_BASE) {
    return new Response(
      JSON.stringify({ error: "NEXT_PUBLIC_API_BASE_URL is not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const headers = buildHeaders(req);
  const queries = ["?limit=200&offset=0", "?limit=200", ""];
  const bases = API_BASE_CANDIDATES;
  const paths = [
    "/admin/categories",
    "/admin/category",
    "/auth/admin/categories",
    "/auth/admin/category",
    "/seller/categories",
    "/seller/category",
    "/categories",
    "/category",
  ];

  const candidates: string[] = [];
  for (const base of bases) {
    for (const path of paths) {
      for (const query of queries) {
        candidates.push(`${base}${path}${query}`);
      }
    }
  }

  let lastStatus = 0;
  let lastBody = "";
  const attempts: Array<{ url: string; status: number; sample: string }> = [];
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      const text = await res.text();
      lastStatus = res.status;
      lastBody = text;
      attempts.push({
        url,
        status: res.status,
        sample: String(text ?? "").slice(0, 180),
      });

      if (res.status >= 200 && res.status < 300 && text) {
        let payload: unknown = text;
        try {
          payload = JSON.parse(text);
        } catch {
          payload = text;
        }
        if (!hasCategoryLikeRecords(payload)) {
          continue;
        }
        const categories = normalizeCategories(payload);
        return new Response(
          JSON.stringify({
            source: url,
            status: res.status,
            payload,
            categories,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch {
      attempts.push({
        url,
        status: 0,
        sample: "network error",
      });
    }
  }

  return new Response(
    JSON.stringify({
      error: "No category endpoint returned successful data.",
      lastStatus,
      lastBody,
      attempts,
    }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );
}
