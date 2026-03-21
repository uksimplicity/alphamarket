"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";

type ProductTypeOption = {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
};

const ADMIN_PRODUCT_TYPES_CACHE_KEY = "alpha.admin.product-types";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function walkRecords(payload: unknown, target: Record<string, unknown>[] = []) {
  if (Array.isArray(payload)) {
    payload.forEach((item) => walkRecords(item, target));
    return target;
  }
  const record = asRecord(payload);
  if (!record) return target;

  const hasId = typeof record.id === "string" || typeof record.uuid === "string";
  const hasName = typeof record.name === "string" || typeof record.title === "string";
  if (hasId && hasName) target.push(record);

  Object.values(record).forEach((value) => walkRecords(value, target));
  return target;
}

function parseOptions(payload: unknown): ProductTypeOption[] {
  return walkRecords(payload, [])
    .map((row) => ({
      id: String(row.id ?? row.uuid ?? row.product_type_id ?? row.type_id ?? "").trim(),
      name: String(row.name ?? row.title ?? row.type_name ?? row.product_type ?? "").trim(),
      categoryId: String(row.category_id ?? row.categoryId ?? "").trim(),
      categoryName: String(row.category_name ?? row.categoryName ?? "").trim(),
    }))
    .filter((row) => row.id && row.name);
}

export default function VendorProductTypes() {
  const [types, setTypes] = useState<ProductTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isRequestInFlight = useRef(false);

  function persistProductTypes(nextTypes: ProductTypeOption[]) {
    if (typeof window === "undefined") return;
    try {
      const normalized = nextTypes.map((item) => ({
        id: String(item.id ?? "").trim(),
        name: String(item.name ?? "").trim(),
        categoryId: String(item.categoryId ?? "").trim(),
        categoryName: String(item.categoryName ?? "").trim(),
      }));
      localStorage.setItem(ADMIN_PRODUCT_TYPES_CACHE_KEY, JSON.stringify(normalized));
    } catch {
      // ignore local storage failures
    }
  }

  const loadTypes = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (isRequestInFlight.current) return;
    isRequestInFlight.current = true;
    if (!silent) setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const token = auth?.access_token;
      const response = await fetch(
        "/api/seller/catalog?resource=product-types&limit=200&offset=0",
        {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to load product types (${response.status}).`);
      }
      const payload = await response.json();
      const parsed = parseOptions(payload);
      setTypes(parsed);
      if (parsed.length > 0) {
        persistProductTypes(parsed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product types.");
    } finally {
      isRequestInFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const intervalId = window.setInterval(() => {
      void loadTypes({ silent: true });
    }, 5000);

    const handleFocus = () => {
      void loadTypes({ silent: true });
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadTypes]);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Product Types</h1>
          <p className="mt-1 text-sm text-slate-500">
            Product types are created by admin and selected from the dropdown when you create a product.
          </p>
        </div>
      </div>

      {loading ? <div className="text-sm text-slate-500">Loading product types...</div> : null}
      {error ? <div className="text-sm text-rose-600">{error}</div> : null}

      {!loading && !error ? (
        types.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            {types.map((type) => (
              <div
                key={type.id}
                className="flex items-center justify-between border-b border-slate-200 px-4 py-3 last:border-b-0"
              >
                <div>
                  <div className="text-sm font-medium text-slate-800">{type.name}</div>
                  <div className="text-xs text-slate-500">
                    {type.categoryName || "No category linked"}
                  </div>
                </div>
                <div className="text-xs text-slate-500">{type.id}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            No product types yet. Ask admin to create product types.
          </div>
        )
      ) : null}
    </div>
  );
}
