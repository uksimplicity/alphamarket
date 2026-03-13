"use client";

import { getAuth } from "@/components/auth/authStorage";

export async function adminFetcher<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const auth = getAuth();
  const token = auth?.access_token;
  const headers = new Headers(init?.headers);

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(`/api/admin${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? data.error
        : `Request failed (${response.status}).`;
    throw new Error(String(message));
  }

  return data as T;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;

  const record = asRecord(value);
  if (!record) return [];

  const candidates = [
    record.data,
    record.items,
    record.results,
    record.users,
    record.vendors,
    record.products,
    record.orders,
    record.rows,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    const nested = asRecord(candidate);
    if (!nested) continue;

    for (const nestedValue of Object.values(nested)) {
      if (Array.isArray(nestedValue)) return nestedValue;
    }
  }

  return [];
}

export function pickString(
  record: Record<string, unknown> | null,
  keys: string[],
  fallback = ""
): string {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }

  return fallback;
}

export function pickNumber(
  record: Record<string, unknown> | null,
  keys: string[],
  fallback = 0
): number {
  if (!record) return fallback;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }

  return fallback;
}
