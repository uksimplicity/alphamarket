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
