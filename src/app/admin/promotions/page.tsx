"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type PromotionsData = {
  banners: Array<{ id: string; title: string; status: string }>;
  featured: Array<{ id: string; type: string; name: string; createdBy: string; date: string }>;
  cms: Array<{ id: string; title: string; status: string }>;
};

export default function AdminPromotionsPage() {
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    parentCategoryId: "",
    parentCategoryName: "",
  });
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: async () => {
      const [brandsPayload, categoriesPayload, tagsPayload] = await Promise.all([
        adminFetcher<unknown>("/brands?limit=50"),
        adminFetcher<unknown>("/categories?limit=50"),
        adminFetcher<unknown>("/tags?limit=50"),
      ]);

      return {
        banners: asArray(brandsPayload).map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "uuid"], `brand-${index}`),
            title: pickString(record, ["name", "title"], "Unnamed brand"),
            status: pickString(record, ["slug", "website_url"], "brand"),
          };
        }),
        featured: asArray(categoriesPayload).map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "uuid"], `category-${index}`),
            type: "category",
            name: pickString(record, ["name", "title"], "Unnamed category"),
            createdBy: pickString(record, ["created_by", "createdBy"], "Admin"),
            date: pickString(record, ["created_at", "date"], "01 Jul, 2022"),
          };
        }),
        cms: asArray(tagsPayload).map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "uuid"], `tag-${index}`),
            title: pickString(record, ["name", "title"], "Unnamed tag"),
            status: pickString(record, ["slug", "description"], "tag"),
          };
        }),
      } satisfies PromotionsData;
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
        message={error instanceof Error ? error.message : "Failed to load promotions."}
        onRetry={refetch}
      />
    );
  }

  function toSlug(name: string) {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function buildDefaultPayload(type: "brands" | "categories" | "tags", currentName = "") {
    const name = currentName || `New ${type.slice(0, -1)}`;
    if (type === "brands") {
      return { name, slug: toSlug(name), description: "" };
    }
    if (type === "categories") {
      return { name, description: "" };
    }
    return { name, slug: toSlug(name), description: "" };
  }

  async function createEntity(type: "brands" | "tags") {
    const seed = buildDefaultPayload(type);
    const input = window.prompt(
      `Create ${type.slice(0, -1)} payload as JSON`,
      JSON.stringify(seed, null, 2)
    );
    if (!input) return;

    try {
      setActionMessage("");
      setPendingKey(`create-${type}`);
      const payload = JSON.parse(input) as Record<string, unknown>;
      await adminFetcher(`/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setActionMessage(`${type.slice(0, -1)} created successfully.`);
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : `Failed to create ${type}.`);
    } finally {
      setPendingKey("");
    }
  }

  async function createCategory() {
    const name = categoryForm.name.trim();
    const description = categoryForm.description.trim();
    const imageUrl = categoryForm.imageUrl.trim();
    const parentCategoryId = categoryForm.parentCategoryId.trim();
    const parentCategoryName = categoryForm.parentCategoryName.trim();
    if (!name) {
      setActionMessage("Category name is required.");
      return;
    }

    try {
      setActionMessage("");
      setPendingKey("create-categories");
      await adminFetcher("/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          image_url: imageUrl,
          name,
          parent_category:
            parentCategoryId || parentCategoryName
              ? [
                  {
                    id: parentCategoryId,
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
        imageUrl: "",
        parentCategoryId: "",
        parentCategoryName: "",
      });
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to create categories.");
    } finally {
      setPendingKey("");
    }
  }

  const filteredCategories = data.featured.filter((item) => {
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

  async function getEntity(type: "brands" | "categories" | "tags", id: string) {
    try {
      setActionMessage("");
      setPendingKey(`get-${type}-${id}`);
      const payload = await adminFetcher<unknown>(`/${type}/${id}`);
      window.alert(JSON.stringify(payload, null, 2));
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : `Failed to fetch ${type} by id.`);
    } finally {
      setPendingKey("");
    }
  }

  async function updateEntity(
    type: "brands" | "categories" | "tags",
    id: string,
    currentName: string
  ) {
    const seed = { id, ...buildDefaultPayload(type, currentName) };
    const input = window.prompt(
      `Update ${type.slice(0, -1)} payload as JSON`,
      JSON.stringify(seed, null, 2)
    );
    if (!input) return;

    try {
      setActionMessage("");
      setPendingKey(`put-${type}-${id}`);
      const payload = JSON.parse(input) as Record<string, unknown>;
      await adminFetcher(`/${type}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setActionMessage(`${type.slice(0, -1)} updated successfully.`);
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : `Failed to update ${type}.`);
    } finally {
      setPendingKey("");
    }
  }

  async function deleteEntity(type: "brands" | "categories" | "tags", id: string) {
    if (!window.confirm(`Delete ${type.slice(0, -1)} ${id}?`)) return;
    try {
      setActionMessage("");
      setPendingKey(`delete-${type}-${id}`);
      await adminFetcher(`/${type}/${id}`, { method: "DELETE" });
      setActionMessage(`${type.slice(0, -1)} deleted successfully.`);
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : `Failed to delete ${type}.`);
    } finally {
      setPendingKey("");
    }
  }

  return (
    <div className="grid gap-6">
      {actionMessage ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {actionMessage}
        </div>
      ) : null}
      <Card>
        <SectionTitle
          title="Brands"
          subtitle="Brand records from the admin catalog."
          action={
            <Button
              disabled={pendingKey === "create-brands"}
              onClick={() => createEntity("brands")}
            >
              {pendingKey === "create-brands" ? "Creating..." : "Add Brand"}
            </Button>
          }
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.banners.map((banner) => (
            <div
              key={banner.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{banner.title}</div>
                <div className="text-xs text-slate-500">{banner.status}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={pendingKey === `get-brands-${banner.id}`}
                  onClick={() => getEntity("brands", banner.id)}
                >
                  View
                </Button>
                <Button
                  variant="ghost"
                  disabled={pendingKey === `put-brands-${banner.id}`}
                  onClick={() => updateEntity("brands", banner.id, banner.title)}
                >
                  Edit
                </Button>
                <Button
                  disabled={pendingKey === `delete-brands-${banner.id}`}
                  onClick={() => deleteEntity("brands", banner.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="Categories List"
          action={
            <Button onClick={() => setShowCategoryForm((prev) => !prev)}>
              {showCategoryForm ? "Close" : "Create Categories"}
            </Button>
          }
        />
        {showCategoryForm ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category Name
                </label>
                <input
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                  placeholder="e.g. Electronics"
                />
              </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </label>
              <input
                  value={categoryForm.description}
                  onChange={(event) =>
                    setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                placeholder="Optional description"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Image URL
              </label>
              <input
                value={categoryForm.imageUrl}
                onChange={(event) =>
                  setCategoryForm((prev) => ({ ...prev, imageUrl: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                placeholder="https://..."
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Parent Category ID
              </label>
              <input
                value={categoryForm.parentCategoryId}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    parentCategoryId: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                placeholder="Parent ID"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Parent Category Name
              </label>
              <input
                value={categoryForm.parentCategoryName}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    parentCategoryName: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                placeholder="Parent name"
              />
            </div>
            <Button
              disabled={pendingKey === "create-categories"}
              onClick={createCategory}
            >
                {pendingKey === "create-categories" ? "Creating..." : "Create Category"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
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
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="all">Create by</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          >
            <option value="all">Date</option>
            <option value="2022">2022</option>
            <option value="2023">2023</option>
            <option value="2024">2024</option>
          </select>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500">
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
                          d="M5 6h14v12H5V6zm3 3l2 2 4-4 3 3"
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
                  <td className="px-4 py-3">{item.date}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        className="text-slate-500 hover:text-brand"
                        disabled={pendingKey === `put-categories-${item.id}`}
                        onClick={() => updateEntity("categories", item.id, item.name)}
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
                        onClick={() => deleteEntity("categories", item.id)}
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
      </Card>

      <Card>
        <SectionTitle
          title="Tags"
          subtitle="Promotional taxonomy and labels."
          action={
            <Button
              disabled={pendingKey === "create-tags"}
              onClick={() => createEntity("tags")}
            >
              {pendingKey === "create-tags" ? "Creating..." : "Add Tag"}
            </Button>
          }
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.cms.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{entry.title}</div>
                <div className="text-xs text-slate-500">{entry.status}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={pendingKey === `get-tags-${entry.id}`}
                  onClick={() => getEntity("tags", entry.id)}
                >
                  View
                </Button>
                <Button
                  variant="ghost"
                  disabled={pendingKey === `put-tags-${entry.id}`}
                  onClick={() => updateEntity("tags", entry.id, entry.title)}
                >
                  Edit
                </Button>
                <Button
                  disabled={pendingKey === `delete-tags-${entry.id}`}
                  onClick={() => deleteEntity("tags", entry.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
