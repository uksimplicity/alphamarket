"use client";

import { clearAuth, getAuth } from "@/components/auth/authStorage";

function isExpiredTokenMessage(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.includes("invalid or expired token") ||
    normalized.includes("token expired") ||
    normalized.includes("expired token") ||
    normalized.includes("jwt expired") ||
    normalized.includes("invalid token")
  );
}

async function readResponseData(response: Response) {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return data;
}

function extractErrorMessage(data: unknown, status: number) {
  const record = asRecord(data);
  if (record) {
    const primary = String(record.error ?? record.message ?? `Request failed (${status}).`);
    const details =
      typeof record.details === "string" && record.details.trim() ? record.details.trim() : "";
    if (details && details !== primary) {
      return `${primary} ${details}`;
    }
    return primary;
  }
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }
  return `Request failed (${status}).`;
}

async function callApi(basePath: string, path: string, init: RequestInit | undefined, token?: string) {
  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.delete("Authorization");
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  const response = await fetch(`${basePath}${path}`, {
    ...init,
    headers,
  });
  const data = await readResponseData(response);

  return { response, data };
}

export async function adminFetcher<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const auth = getAuth();
  const token = auth?.access_token;
  let { response, data } = await callApi("/api/admin", path, init, token);

  if (!response.ok && token) {
    const firstMessage = extractErrorMessage(data, response.status);
    if (isExpiredTokenMessage(firstMessage)) {
      clearAuth();
      const retry = await callApi("/api/admin", path, init, undefined);
      response = retry.response;
      data = retry.data;
      if (!response.ok) {
        const retryMessage = extractErrorMessage(data, response.status);
        if (response.status === 401 || response.status === 403) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(retryMessage);
      }
      return data as T;
    }
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, response.status));
  }

  return data as T;
}

export async function authAdminFetcher<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const auth = getAuth();
  const token = auth?.access_token;
  let { response, data } = await callApi("/api/auth/admin", path, init, token);

  if (!response.ok && token) {
    const firstMessage = extractErrorMessage(data, response.status);
    if (isExpiredTokenMessage(firstMessage)) {
      clearAuth();
      const retry = await callApi("/api/auth/admin", path, init, undefined);
      response = retry.response;
      data = retry.data;
      if (!response.ok) {
        const retryMessage = extractErrorMessage(data, response.status);
        if (response.status === 401 || response.status === 403) {
          throw new Error("Session expired. Please log in again.");
        }
        throw new Error(retryMessage);
      }
      return data as T;
    }
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, response.status));
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
