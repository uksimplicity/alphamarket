"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  adminFetcher,
  asArray,
  asRecord,
  pickString,
} from "@/components/admin/api";
import { getAuth } from "@/components/auth/authStorage";
import { Card, ErrorState, Skeleton } from "@/components/dashboard/ui";

type Category = {
  id: string;
  name: string;
  createdBy: string;
  date: string;
};

type CategoryDeleteTarget = {
  id: string;
  slug?: string;
};

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildDynamicSlug(name: string) {
  const base = toSlug(name) || "category";
  const time = Date.now().toString(36);
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6)
      : Math.random().toString(36).slice(2, 8);
  return `${base}-${time}-${random}`;
}

export default function AdminCategoriesPage() {
  const ADMIN_CATEGORIES_CACHE_KEY = "alpha.admin.categories";
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [cachedCategories, setCachedCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    parentCategoryId: "",
  });

  function extractCategoryRecords(payload: unknown): Record<string, unknown>[] {
    const found: Record<string, unknown>[] = [];
    const visited = new WeakSet<object>();

    function walk(value: unknown) {
      if (Array.isArray(value)) {
        for (const item of value) walk(item);
        return;
      }

      const record = asRecord(value);
      if (!record) return;
      if (visited.has(record)) return;
      visited.add(record);

      const nameValue =
        typeof record.name === "string"
          ? record.name
          : typeof record.title === "string"
            ? record.title
            : typeof record.category_name === "string"
              ? record.category_name
              : typeof record.categoryName === "string"
                ? record.categoryName
            : "";
      const hasName = nameValue.trim().length > 0;
      const hasId =
        typeof record.id === "string" ||
        typeof record.id === "number" ||
        typeof record.uuid === "string" ||
        typeof record.category_id === "string" ||
        typeof record.categoryId === "string";

      if (hasName && hasId) {
        found.push(record);
      }

      for (const nested of Object.values(record)) {
        walk(nested);
      }
    }

    walk(payload);
    return found;
  }

  async function callCategoryEndpoint<T>(path: string, init?: RequestInit): Promise<T> {
    return adminFetcher<T>(path, init);
  }

  async function hardDeleteCategory(target: CategoryDeleteTarget): Promise<void> {
    const slug = (target.slug ?? "").trim();
    const id = target.id.trim();
    const paths = [
      `/categories/${id}?hard=true`,
      `/categories/${id}?force=true`,
      `/categories/${id}`,
      ...(slug ? [`/categories/slug/${encodeURIComponent(slug)}`] : []),
    ];

    let lastError: unknown = null;
    for (const path of paths) {
      try {
        await callCategoryEndpoint(path, { method: "DELETE" });
        return;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Failed to delete category.");
  }

  async function fetchCategoriesPayload(): Promise<unknown> {
    const probeCategoryRoute = async () => {
      const auth = getAuth();
      const token = auth?.access_token;
      const response = await fetch("/api/admin/categories/raw", {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Category probe failed (${response.status}).`);
      }
      const data = await response.json();
      return data?.categories ?? data?.payload ?? data;
    };

    const sellerCatalogFallback = async () => {
      const auth = getAuth();
      const token = auth?.access_token;
      const response = await fetch("/api/seller/catalog?resource=categories&limit=200&offset=0", {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Seller catalog categories failed (${response.status}).`);
      }
      return response.json();
    };

    const attempts = [
      probeCategoryRoute,
      () => adminFetcher<unknown>("/categories?limit=100&offset=0"),
      () => adminFetcher<unknown>("/categories"),
      () => adminFetcher<unknown>("/categories?limit=100"),
      sellerCatalogFallback,
    ];

    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Unable to fetch categories.");
  }

  async function fetchCategoriesPayloadForSlugConflict(name: string): Promise<unknown[]> {
    const slug = toSlug(name);
    const encodedName = encodeURIComponent(name);
    const encodedSlug = encodeURIComponent(slug);
    const queries = [
      `/categories?include_deleted=true&limit=200&offset=0`,
      `/categories?deleted=true&limit=200&offset=0`,
      `/categories?with_deleted=true&limit=200&offset=0`,
      `/categories?search=${encodedName}&include_deleted=true&limit=200&offset=0`,
      `/categories?name=${encodedName}&include_deleted=true&limit=200&offset=0`,
      `/categories?slug=${encodedSlug}&include_deleted=true&limit=200&offset=0`,
    ];

    const results: unknown[] = [];
    for (const query of queries) {
      try {
        results.push(await adminFetcher<unknown>(query));
      } catch {
        // best-effort probing for soft-deleted rows
      }
    }
    return results;
  }

  async function purgeConflictingCategoriesByName(name: string): Promise<number> {
    const slug = toSlug(name);
    const payloads = await fetchCategoriesPayloadForSlugConflict(name);
    const targetsById = new Map<string, CategoryDeleteTarget>();

    for (const payload of payloads) {
      const records = extractCategoryRecords(payload);
      const fallbackRows = asArray(payload).flatMap((row) =>
        Array.isArray(row) ? row : [row]
      );
      const allRecords = records.length
        ? records
        : (fallbackRows
            .map((row) => asRecord(row))
            .filter(Boolean) as Record<string, unknown>[]);

      for (const record of allRecords) {
        const id = pickString(record, ["id", "uuid", "category_id", "categoryId"], "").trim();
        if (!id) continue;
        const recordName = pickString(
          record,
          ["name", "title", "category_name", "categoryName"],
          ""
        )
          .trim()
          .toLowerCase();
        const recordSlug = pickString(record, ["slug"], "").trim().toLowerCase();
        if (recordName === name.trim().toLowerCase() || recordSlug === slug) {
          targetsById.set(id, { id, slug: recordSlug || undefined });
        }
      }
    }

    let deletedCount = 0;
    for (const target of targetsById.values()) {
      try {
        await hardDeleteCategory(target);
        deletedCount += 1;
      } catch {
        // ignore individual failures
      }
    }
    return deletedCount;
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      try {
        const mapPayloadToCategories = (payload: unknown) => {
          const discovered = extractCategoryRecords(payload);
          const fallbackRows = asArray(payload).flatMap((row) =>
            Array.isArray(row) ? row : [row]
          );
          const records = discovered.length
            ? discovered
            : fallbackRows.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[];

          const mapped = records.map((record, index) => {
            const rawName = pickString(
              record,
              ["name", "title", "category_name", "categoryName"],
              ""
            ).trim();
            if (!rawName) {
              return null;
            }
            return {
              id: pickString(record, ["id", "uuid", "category_id", "categoryId"], `category-${index}`),
              name: rawName,
              createdBy: pickString(record, ["created_by", "createdBy"], "Admin"),
              date: pickString(record, ["created_at", "date"], ""),
            } satisfies Category;
          });
          const seen = new Set<string>();
          return mapped.filter((item): item is Category => {
            if (!item) return false;
            const key = `${item.id}:${item.name.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
        };
        const primaryPayload = await fetchCategoriesPayload();
        const primaryMapped = mapPayloadToCategories(primaryPayload);
        if (primaryMapped.length > 0) {
          return primaryMapped;
        }

        try {
          const productsPayload = await (async () => {
            return adminFetcher<unknown>("/products?limit=300&offset=0");
          })();
          const productsMapped = mapPayloadToCategories(productsPayload);
          if (productsMapped.length > 0) return productsMapped;
          return [] as Category[];
        } catch {
          return [] as Category[];
        }
      } catch {
        return [] as Category[];
      }
    },
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMIN_CATEGORIES_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => asRecord(item))
            .filter(Boolean)
            .map((record) => ({
              id: pickString(record, ["id", "uuid", "category_id", "categoryId"], ""),
              name: pickString(record, ["name", "title", "category_name", "categoryName"], ""),
              createdBy: pickString(record, ["createdBy", "created_by"], "Admin"),
              date: pickString(record, ["date", "created_at"], ""),
            }))
            .filter((item) => item.id && item.name);
          setCachedCategories(normalized);
        }
      }
    } catch {
      // ignore local cache parse errors
    } finally {
      setCacheHydrated(true);
    }
  }, []);

  const categories = useMemo(
    () => ((data && data.length > 0 ? data : cachedCategories) ?? []),
    [data, cachedCategories]
  );
  useEffect(() => {
    if (!cacheHydrated) return;
    if (categories.length === 0) return;
    try {
      localStorage.setItem(ADMIN_CATEGORIES_CACHE_KEY, JSON.stringify(categories));
      setCachedCategories(categories);
    } catch {
      // ignore storage write errors
    }
  }, [cacheHydrated, categories]);

  if (isLoading && cachedCategories.length === 0) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error && categories.length === 0) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load categories."}
        onRetry={refetch}
      />
    );
  }

  async function createCategory() {
    const name = categoryForm.name.trim();
    if (!name) {
      setActionMessage("Category name is required.");
      return;
    }
    const exists = categories.some((item) => item.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      setActionMessage("Category name already exists. Please use a different name.");
      return;
    }

    try {
      setActionMessage("");
      setPendingKey("create-categories");
      const parentCategoryId = categoryForm.parentCategoryId.trim();
      const selectedParent = categories.find((item) => item.id === parentCategoryId) ?? null;
      const basePayload = {
        description: categoryForm.description.trim(),
        name,
        slug: buildDynamicSlug(name),
        parent_category:
          selectedParent?.id
            ? [
                {
                  id: selectedParent.id,
                  name: selectedParent.name,
                },
              ]
            : null,
      };

      let createdPayload: unknown = null;
      try {
        createdPayload = await callCategoryEndpoint("/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basePayload),
        });
      } catch (firstError) {
        const firstMessage =
          firstError instanceof Error ? firstError.message : String(firstError);
        if (
          firstMessage.includes("idx_categories_slug") ||
          firstMessage.includes("SQLSTATE 23505") ||
          firstMessage.toLowerCase().includes("duplicate slug")
        ) {
          await purgeConflictingCategoriesByName(name);
          try {
            createdPayload = await callCategoryEndpoint("/categories", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(basePayload),
            });
          } catch (retryError) {
            const retryMessage =
              retryError instanceof Error ? retryError.message : String(retryError);
            if (
              retryMessage.includes("idx_categories_slug") ||
              retryMessage.includes("SQLSTATE 23505") ||
              retryMessage.toLowerCase().includes("duplicate slug")
            ) {
              const uniqueSlug = buildDynamicSlug(name);
              createdPayload = await callCategoryEndpoint("/categories", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...basePayload,
                  slug: uniqueSlug,
                }),
              });
            } else {
              throw retryError;
            }
          }
        } else {
          throw firstError;
        }
      }

      setActionMessage("Category created successfully.");
      setCachedCategories((prev) => {
        const createdRecord = extractCategoryRecords(createdPayload)[0] ?? asRecord(createdPayload);
        const optimistic: Category = {
          id:
            pickString(createdRecord, ["id", "uuid", "category_id", "categoryId"], "").trim() ||
            `local-${Date.now().toString(36)}`,
          name,
          createdBy: "Admin",
          date: new Date().toISOString(),
        };
        const next = [optimistic, ...prev.filter((item) => item.name !== optimistic.name)];
        try {
          localStorage.setItem(ADMIN_CATEGORIES_CACHE_KEY, JSON.stringify(next));
        } catch {
          // ignore cache write errors
        }
        return next;
      });
      setCategoryForm({
        name: "",
        description: "",
        parentCategoryId: "",
      });
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create category.";
      setActionMessage(message);
    } finally {
      setPendingKey("");
    }
  }

  async function updateCategory(id: string, name: string) {
    const seed = { id, name, description: "", image_url: "", parent_category: [] as unknown[] };
    const input = window.prompt("Update category payload as JSON", JSON.stringify(seed, null, 2));
    if (!input) return;
    try {
      setActionMessage("");
      setPendingKey(`put-categories-${id}`);
      const payload = JSON.parse(input) as Record<string, unknown>;
      await callCategoryEndpoint(`/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setActionMessage("Category updated successfully.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update category.");
    } finally {
      setPendingKey("");
    }
  }

  async function deleteCategory(id: string) {
    if (!window.confirm(`Delete category ${id}?`)) return;
    try {
      setActionMessage("");
      setPendingKey(`delete-categories-${id}`);
      await hardDeleteCategory({ id });
      setActionMessage("Category deleted successfully.");
      setCachedCategories((prev) => {
        const next = prev.filter((item) => item.id !== id);
        try {
          localStorage.setItem(ADMIN_CATEGORIES_CACHE_KEY, JSON.stringify(next));
        } catch {
          // ignore cache write errors
        }
        return next;
      });
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to delete category.");
    } finally {
      setPendingKey("");
    }
  }

  async function clearAllCategories() {
    try {
      setActionMessage("");
      setPendingKey("clear-all-categories");

      const payload = await fetchCategoriesPayload();
      const records = extractCategoryRecords(payload);
      const fallbackRows = asArray(payload).flatMap((row) =>
        Array.isArray(row) ? row : [row]
      );
      const allRecords = records.length
        ? records
        : (fallbackRows
            .map((row) => asRecord(row))
            .filter(Boolean) as Record<string, unknown>[]);
      const targets: CategoryDeleteTarget[] = Array.from(
        new Map(
          allRecords
            .map((record) => ({
              id: pickString(record, ["id", "uuid", "category_id", "categoryId"], "").trim(),
              slug: pickString(record, ["slug"], "").trim(),
            }))
            .filter((item) => item.id)
            .map((item) => [item.id, item])
        ).values()
      );

      if (targets.length === 0) {
        setActionMessage("No categories to delete.");
        return;
      }

      if (
        !window.confirm(
          `Delete all ${targets.length} categories? This action cannot be undone.`
        )
      ) {
        return;
      }

      for (const target of targets) {
        await hardDeleteCategory(target);
      }
      setActionMessage("All categories deleted successfully.");
      setCachedCategories([]);
      try {
        localStorage.setItem(ADMIN_CATEGORIES_CACHE_KEY, JSON.stringify([]));
      } catch {
        // ignore cache write errors
      }
      await refetch();
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Failed to clear all categories."
      );
    } finally {
      setPendingKey("");
    }
  }

  const filteredCategories = categories.filter((item) => {
    const matchesSearch =
      !categorySearch.trim() ||
      item.name.toLowerCase().includes(categorySearch.toLowerCase()) ||
      item.id.toLowerCase().includes(categorySearch.toLowerCase());
    const matchesCreator =
      createdByFilter === "all" ||
      item.createdBy.toLowerCase() === createdByFilter.toLowerCase();
    const matchesDate = dateFilter === "all" || item.date.includes(dateFilter);
    return matchesSearch && matchesCreator && matchesDate;
  });

  function formatDate(value: string) {
    if (!value) return "01 Jul, 2022";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <Card>
      {error ? (
        <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error instanceof Error ? error.message : "Some category data could not be refreshed."}
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[34px] font-semibold leading-none text-slate-900">
          Categories List
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearAllCategories}
            disabled={pendingKey === "clear-all-categories"}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"
          >
            {pendingKey === "clear-all-categories" ? "Clearing..." : "Clear All"}
          </button>
          <button
            type="button"
            onClick={() => setShowCategoryForm((prev) => !prev)}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2952cc]"
          >
            {showCategoryForm ? "Close" : "Create Categories"}
          </button>
        </div>
      </div>

      {actionMessage ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {actionMessage}
        </div>
      ) : null}

      {showCategoryForm ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <input
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Category Name"
            />
            <input
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Description"
            />
            <select
              value={categoryForm.parentCategoryId}
              onChange={(event) =>
                setCategoryForm((prev) => ({ ...prev, parentCategoryId: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="">No parent category</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={pendingKey === "create-categories"}
              onClick={createCategory}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pendingKey === "create-categories" ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" aria-hidden="true">
            <path
              d="M11 4a7 7 0 1 0 4.4 12.4L20 21"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <input
            value={categorySearch}
            onChange={(event) => setCategorySearch(event.target.value)}
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Search..."
          />
        </div>
        <select
          value={createdByFilter}
          onChange={(event) => setCreatedByFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        >
          <option value="all">Create by</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        >
          <option value="all">Date</option>
          <option value="2022">2022</option>
          <option value="2023">2023</option>
          <option value="2024">2024</option>
        </select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-50/90 text-sm font-semibold text-slate-700">
            <tr>
              <th className="px-4 py-3">
                <input type="checkbox" aria-label="Select all categories" />
              </th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Icon/ image</th>
              <th className="px-4 py-3">Category Name</th>
              <th className="px-4 py-3">Create by</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredCategories.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select category ${item.name}`} />
                  </td>
                  <td className="px-4 py-3">#{item.id.slice(0, 5)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200">
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" aria-hidden="true">
                        <path
                          d="M6 8h12v10H6V8zm3-2h6l1 2H8l1-2z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3">{item.createdBy}</td>
                  <td className="px-4 py-3">{formatDate(item.date)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                      type="button"
                      className="text-slate-500 hover:text-brand"
                      disabled={pendingKey === `put-categories-${item.id}`}
                      onClick={() => updateCategory(item.id, item.name)}
                        aria-label={`Edit category ${item.name}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                          <path
                            d="M4 20l4.5-1 9-9a1.6 1.6 0 0 0 0-2.3l-1.2-1.2a1.6 1.6 0 0 0-2.3 0l-9 9L4 20z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                      className="text-slate-500 hover:text-rose-500"
                      disabled={pendingKey === `delete-categories-${item.id}`}
                      onClick={() => deleteCategory(item.id)}
                        aria-label={`Delete category ${item.name}`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                          <path
                            d="M6 7h12m-9 0v11m6-11v11M9 7V5h6v2m-8 0l1 12h8l1-12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCategories.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    No categories returned from backend yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-end gap-5 text-sm text-slate-500">
        <button type="button" className="hover:text-brand" aria-label="Previous page">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M15 6l-6 6 6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button type="button" className="rounded-md bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
          1
        </button>
        <button type="button" className="hover:text-brand">
          2
        </button>
        <button type="button" className="hover:text-brand">
          3
        </button>
        <span>...</span>
        <button type="button" className="hover:text-brand">
          120
        </button>
        <button type="button" className="hover:text-brand" aria-label="Next page">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M9 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </Card>
  );
}

