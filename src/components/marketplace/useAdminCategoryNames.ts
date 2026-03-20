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

    async function load() {
      const auth = getAuth();
      const token = auth?.access_token;
      try {
        const response = await fetch("/api/admin/categories/raw", {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        });
        if (!response.ok) {
          if (mounted) setCategoryNames(loadCachedCategoryNames());
          return;
        }
        const payload = await response.json();
        const names = normalizeCategoryNames(payload);
        const merged = Array.from(new Set([...names, ...loadCachedCategoryNames()]));
        if (!mounted) return;
        setCategoryNames(merged);
      } catch {
        if (mounted) setCategoryNames(loadCachedCategoryNames());
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return useMemo(() => categoryNames, [categoryNames]);
}
