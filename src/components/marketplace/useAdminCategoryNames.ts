"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";

const ADMIN_CATEGORIES_CACHE_KEY = "alpha.admin.categories";

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function normalizeCategoryNames(payload: unknown): string[] {
  const names: string[] = [];
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

    const hasId = Boolean(
      pickString(record, ["id", "uuid", "category_id", "categoryId"])
    );
    const name = pickString(record, ["name", "title", "category_name", "categoryName"]);
    if (hasId && name) {
      names.push(name);
    }

    Object.values(record).forEach(walk);
  }

  walk(payload);
  return Array.from(new Set(names));
}

function loadCachedCategoryNames() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const raw = localStorage.getItem(ADMIN_CATEGORIES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeCategoryNames(parsed);
  } catch {
    return [];
  }
}

export function useAdminCategoryNames() {
  const [categoryNames, setCategoryNames] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function fetchJson(path: string, token?: string) {
      const response = await fetch(path, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });
      if (!response.ok) return null;
      return response.json();
    }

    async function load() {
      const auth = getAuth();
      const token = auth?.access_token;
      const cached = loadCachedCategoryNames();
      try {
        const collected = new Set<string>();

        const adminPayload = await fetchJson("/api/admin/categories/raw", token);
        if (adminPayload) {
          normalizeCategoryNames(adminPayload).forEach((name) => collected.add(name));
        }

        if (!mounted) return;
        setCategoryNames(collected.size > 0 ? Array.from(collected) : cached);
      } catch {
        if (mounted) setCategoryNames(cached);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return useMemo(() => categoryNames, [categoryNames]);
}
