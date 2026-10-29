"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminFetcher,
  asArray,
  asRecord,
  pickString,
} from "@/components/admin/api";
import { Card, ErrorState, Skeleton } from "@/components/dashboard/ui";
import { extractCategoryRecords, normalizeCategories, type Category } from "@/components/admin/categoryRecords";

type CategoryDeleteTarget = {
  id: string;
  slug?: string;
};

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const PAGE_SIZE = 20;
  const ADMIN_CATEGORIES_CACHE_KEY = "alpha.admin.categories";
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [cachedCategories, setCachedCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    parentCategoryId: "",
  });

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
    return callCategoryEndpoint<unknown>("/categories?limit=200&offset=0");
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => normalizeCategories(await fetchCategoriesPayload()),
  });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ADMIN_CATEGORIES_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          const normalized = normalizeCategories(parsed);
          localStorage.setItem(ADMIN_CATEGORIES_CACHE_KEY, JSON.stringify(normalized));
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
    () => data ?? cachedCategories,
    [data, cachedCategories]
  );
  useEffect(() => {
    if (!cacheHydrated || data === undefined) return;
    try {
      localStorage.setItem(ADMIN_CATEGORIES_CACHE_KEY, JSON.stringify(data));
      setCachedCategories(data);
    } catch {
      // ignore storage write errors
    }
  }, [cacheHydrated, data]);

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
        image_url: "",
        parent_category:
          selectedParent?.id
            ? [
                {
                  id: selectedParent.id,
                  name: selectedParent.name,
                },
              ]
            : [],
      };

      const createdPayload = await callCategoryEndpoint<unknown>("/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload),
      });

      const responseRecord = asRecord(createdPayload);
      if (responseRecord?.success === false) {
        throw new Error(pickString(responseRecord, ["error", "message"], "Category creation failed."));
      }
      setCategoryForm({
        name: "",
        description: "",
        parentCategoryId: "",
      });
      const created = normalizeCategories(createdPayload, name).find(
        (item) => item.name.toLowerCase() === name.toLowerCase()
      );
      const refreshed = await refetch();
      const confirmed = created ?? refreshed.data?.find(
        (item) => item.name.toLowerCase() === name.toLowerCase()
      );
      if (confirmed) {
        queryClient.setQueryData<Category[]>(["admin-categories"], (current) => [
          confirmed,
          ...(current ?? categories).filter((item) => item.id !== confirmed.id),
        ]);
        setActionMessage("Category created successfully.");
      } else {
        setActionMessage("The create request succeeded, but the category's saved ID could not be confirmed. Refresh the list before trying again.");
      }
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
  const totalPages = Math.max(1, Math.ceil(filteredCategories.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCategories = filteredCategories.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  function formatDate(value: string) {
    if (!value) return "—";
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
        <div><h2 className="text-xl font-semibold tracking-tight text-slate-900">Categories</h2><p className="mt-1 text-xs text-slate-500">Organize your catalog and parent categories.</p></div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearAllCategories}
            disabled={pendingKey === "clear-all-categories"}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"
          >
            {pendingKey === "clear-all-categories" ? "Clearing..." : "Clear all"}
          </button>
          <button
            type="button"
            onClick={() => setShowCategoryForm((prev) => !prev)}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2952cc]"
          >
            {showCategoryForm ? "Close form" : "Add category"}
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
              aria-label="Category name"
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Category Name"
            />
            <input
              aria-label="Description"
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Description"
            />
            <select
              aria-label="Parent category"
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
            aria-label="Search categories"
            value={categorySearch}
            onChange={(event) => {
              setCategorySearch(event.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-transparent text-sm outline-none"
            placeholder="Search categories…"
          />
        </div>
        <select
          aria-label="Filter by creator"
          value={createdByFilter}
          onChange={(event) => {
            setCreatedByFilter(event.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        >
          <option value="all">All creators</option>
          <option value="admin">Admin</option>
        </select>
        <select
          aria-label="Filter by year"
          value={dateFilter}
          onChange={(event) => {
            setDateFilter(event.target.value);
            setCurrentPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none"
        >
          <option value="all">All dates</option>
          {Array.from(new Set(categories.map(item => item.date.slice(0, 4)).filter(year => /^\d{4}$/.test(year)))).sort().reverse().map(year => <option key={year} value={year}>{year}</option>)}
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
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Category name</th>
              <th className="px-4 py-3">Created by</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
              {paginatedCategories.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select category ${item.name}`} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400" title={item.id}>#{item.id.slice(0, 5)}</td>
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
                      className="action-icon-edit"
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
                      className="action-icon-delete"
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
                    {categorySearch || createdByFilter !== "all" || dateFilter !== "all" ? "No categories match your filters." : "No categories yet. Add a category to organize your catalog."}
                  </td>
                </tr>
              ) : null}
            </tbody>
        </table>
      </div>

      <div className="mt-6 flex items-center justify-end gap-5 text-sm text-slate-500">
        <button
          type="button"
          className="hover:text-brand disabled:opacity-50"
          aria-label="Previous page"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={safeCurrentPage <= 1}
        >
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
        <span className="rounded-md bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
          {safeCurrentPage}
        </span>
        <span>of</span>
        <span>{totalPages}</span>
        <button
          type="button"
          className="hover:text-brand disabled:opacity-50"
          aria-label="Next page"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={safeCurrentPage >= totalPages}
        >
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

