"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  adminFetcher,
  authAdminFetcher,
  asArray,
  asRecord,
  pickString,
} from "@/components/admin/api";
import { Card, ErrorState, Skeleton } from "@/components/dashboard/ui";

type Category = {
  id: string;
  name: string;
  createdBy: string;
  date: string;
};

export default function AdminCategoriesPage() {
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    parentCategoryName: "",
  });

  function isNotFoundError(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    return message.includes("(404)") || message.includes("404");
  }

  function shouldTryNextCategoryEndpoint(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    return (
      message.includes("(404)") ||
      message.includes("404") ||
      message.includes("(405)") ||
      message.includes("405") ||
      message.includes("(500)") ||
      message.includes("500")
    );
  }

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

      const hasName = typeof record.name === "string" || typeof record.title === "string";
      const hasId =
        typeof record.id === "string" ||
        typeof record.id === "number" ||
        typeof record.uuid === "string";

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
    const method = (init?.method ?? "GET").toUpperCase();
    const candidates = [
      ...(method === "GET"
        ? [() => authAdminFetcher<T>(path, init), () => adminFetcher<T>(path, init)]
        : [() => adminFetcher<T>(path, init), () => authAdminFetcher<T>(path, init)]),
      () => adminFetcher<T>(path.replace("/categories", "/category"), init),
      () => authAdminFetcher<T>(path.replace("/categories", "/category"), init),
    ];

    let lastError: unknown = null;
    for (const candidate of candidates) {
      try {
        return await candidate();
      } catch (error) {
        lastError = error;
        if (!shouldTryNextCategoryEndpoint(error)) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Category endpoint unavailable.");
  }

  async function fetchCategoriesPayload(): Promise<unknown> {
    const attempts = [
      () => authAdminFetcher<unknown>("/categories?limit=100&offset=0"),
      () => authAdminFetcher<unknown>("/categories"),
      () => authAdminFetcher<unknown>("/categories?limit=100"),
      () => adminFetcher<unknown>("/categories?limit=100&offset=0"),
      () => adminFetcher<unknown>("/categories"),
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

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      try {
        const categoriesPayload = await fetchCategoriesPayload();
        const discovered = extractCategoryRecords(categoriesPayload);
        const fallbackRows = asArray(categoriesPayload).flatMap((row) =>
          Array.isArray(row) ? row : [row]
        );
        const records = discovered.length
          ? discovered
          : fallbackRows.map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[];

        const mapped = records.map((record, index) => {
          return {
            id: pickString(record, ["id", "uuid"], `category-${index}`),
            name: pickString(record, ["name", "title"], "Unnamed category"),
            createdBy: pickString(record, ["created_by", "createdBy"], "Admin"),
            date: pickString(record, ["created_at", "date"], ""),
          } satisfies Category;
        });
        const seen = new Set<string>();
        return mapped.filter((item) => {
          const key = `${item.id}:${item.name.toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      } catch {
        return [] as Category[];
      }
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
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
    const exists = data.some((item) => item.name.trim().toLowerCase() === name.toLowerCase());
    if (exists) {
      setActionMessage("Category name already exists. Please use a different name.");
      return;
    }

    try {
      setActionMessage("");
      setPendingKey("create-categories");
      const parentCategoryName = categoryForm.parentCategoryName.trim();
      const resolvedParentCategoryId =
        data.find((item) => item.name.toLowerCase() === parentCategoryName.toLowerCase())?.id ?? "";

      await callCategoryEndpoint("/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: categoryForm.description.trim(),
          name,
          parent_category:
            resolvedParentCategoryId || parentCategoryName
              ? [
                  {
                    id: resolvedParentCategoryId,
                    name: parentCategoryName,
                  },
                ]
          : [],
        }),
      });
      setActionMessage("Category created successfully.");
      setCategoryForm({
        name: "",
        description: "",
        parentCategoryName: "",
      });
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create category.";
      if (message.includes("idx_categories_slug") || message.includes("SQLSTATE 23505")) {
        setActionMessage("Category already exists (duplicate slug). Please use a different name.");
      } else {
        setActionMessage(message);
      }
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
      await callCategoryEndpoint(`/categories/${id}`, { method: "DELETE" });
      setActionMessage("Category deleted successfully.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to delete category.");
    } finally {
      setPendingKey("");
    }
  }

  const filteredCategories = data.filter((item) => {
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
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[34px] font-semibold leading-none text-slate-900">
          Categories List
        </h2>
        <button
          type="button"
          onClick={() => setShowCategoryForm((prev) => !prev)}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2952cc]"
        >
          {showCategoryForm ? "Close" : "Create Categories"}
        </button>
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
            <input
              value={categoryForm.parentCategoryName}
              onChange={(event) =>
                setCategoryForm((prev) => ({ ...prev, parentCategoryName: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Parent Category Name"
            />
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

