"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, authAdminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Card, ErrorState, Skeleton } from "@/components/dashboard/ui";

type Attribute = {
  id: string;
  name: string;
  description: string;
  icon: string;
  categoryIds: string[];
  values: string[];
  createdBy: string;
  date: string;
};

async function callAttributeEndpoint<T>(path: string, init?: RequestInit): Promise<T> {
  const withTimeout = async (
    fn: (requestInit?: RequestInit) => Promise<T>,
    timeoutMs = 15000
  ): Promise<T> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fn({ ...(init ?? {}), signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const method = (init?.method ?? "GET").toUpperCase();
  const candidates =
    method === "GET" || method === "PUT" || method === "DELETE"
      ? [
          () => withTimeout((requestInit) => adminFetcher<T>(path, requestInit)),
          () => withTimeout((requestInit) => authAdminFetcher<T>(path, requestInit)),
        ]
      : [
          () => withTimeout((requestInit) => authAdminFetcher<T>(path, requestInit)),
          () => withTimeout((requestInit) => adminFetcher<T>(path, requestInit)),
        ];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return await candidate();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Attributes endpoint unavailable.");
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export default function AdminAttributesPage() {
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [form, setForm] = useState({
    name: "",
    description: "",
    icon: "",
    categoryIdsText: "",
    valuesText: "",
  });
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    icon: "",
    categoryIdsText: "",
    valuesText: "",
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-attributes-page"],
    queryFn: async () => {
      const payload = await callAttributeEndpoint<unknown>("/attributes?limit=100&offset=0");
      return asArray(payload).map((row, index) => {
        const record = asRecord(row);
        return {
          id: pickString(record, ["id", "uuid"], `attribute-${index}`),
          name: pickString(record, ["name", "title"], "Unnamed attribute"),
          description: pickString(record, ["description"], ""),
          icon: pickString(record, ["icon", "image_url", "image"], ""),
          categoryIds: toStringArray(record?.category_ids),
          values: toStringArray(record?.values),
          createdBy: pickString(record, ["created_by", "createdBy"], "Admin"),
          date: pickString(record, ["created_at", "date"], ""),
        } satisfies Attribute;
      });
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
        message={error instanceof Error ? error.message : "Failed to load attributes."}
        onRetry={refetch}
      />
    );
  }

  async function createAttribute() {
    if (!form.name.trim()) {
      setActionMessage("Attribute name is required.");
      return;
    }

    const payload = {
      category_ids: form.categoryIdsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      description: form.description.trim(),
      icon: form.icon.trim(),
      name: form.name.trim(),
      values: form.valuesText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      setPendingKey("create-attribute");
      setActionMessage("");
      await callAttributeEndpoint("/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setActionMessage("Attribute created successfully.");
      setForm({
        name: "",
        description: "",
        icon: "",
        categoryIdsText: "",
        valuesText: "",
      });
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to create attribute.");
    } finally {
      setPendingKey("");
    }
  }

  async function submitEditAttribute() {
    if (!editingId) return;
    if (editingId.startsWith("attribute-") || editingId.startsWith("temp-")) {
      setActionMessage("This row has no real backend ID yet, so it cannot be updated.");
      return;
    }
    if (!editForm.name.trim()) {
      setActionMessage("Attribute name is required.");
      return;
    }

    const payload = {
      id: editingId,
      name: editForm.name.trim(),
      description: editForm.description.trim(),
      icon: editForm.icon.trim(),
      category_ids: editForm.categoryIdsText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      values: editForm.valuesText
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      setPendingKey(`edit-${editingId}`);
      setActionMessage("");
      try {
        await callAttributeEndpoint(`/attributes/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (firstError) {
        const message = firstError instanceof Error ? firstError.message : "";
        if (message.includes("404")) {
          await authAdminFetcher(`/attributes/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          throw firstError;
        }
      }
      setActionMessage("Attribute updated successfully.");
      setEditingId("");
      setEditForm({
        name: "",
        description: "",
        icon: "",
        categoryIdsText: "",
        valuesText: "",
      });
      await refetch();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setActionMessage("Update timed out. Please retry.");
      } else {
        setActionMessage(err instanceof Error ? err.message : "Failed to update attribute.");
      }
    } finally {
      setPendingKey("");
    }
  }

  async function startEditAttribute(item: Attribute) {
    setPendingKey(`get-${item.id}`);
    setActionMessage("");
    try {
      const payload = await callAttributeEndpoint<unknown>(`/attributes/${item.id}`, {
        method: "GET",
      });
      const record = asRecord(payload);
      const name = pickString(record, ["name", "title"], item.name);
      setEditingId(item.id);
      setEditForm({
        name,
        description: pickString(record, ["description"], item.description),
        icon: pickString(record, ["icon", "image_url", "image"], item.icon),
        categoryIdsText: toStringArray(record?.category_ids).join(", ") || item.categoryIds.join(", "),
        valuesText: toStringArray(record?.values).join(", ") || item.values.join(", "),
      });
    } catch {
      setEditingId(item.id);
      setEditForm({
        name: item.name,
        description: item.description,
        icon: item.icon,
        categoryIdsText: item.categoryIds.join(", "),
        valuesText: item.values.join(", "),
      });
    } finally {
      setPendingKey("");
    }
  }

  async function deleteAttribute(id: string) {
    if (!window.confirm(`Delete attribute ${id}?`)) return;
    try {
      setPendingKey(`delete-${id}`);
      setActionMessage("");
      await callAttributeEndpoint(`/attributes/${id}`, { method: "DELETE" });
      setActionMessage("Attribute deleted successfully.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to delete attribute.");
    } finally {
      setPendingKey("");
    }
  }

  const filteredAttributes = data.filter((item) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q);
    const matchesCreator =
      createdByFilter === "all" || item.createdBy.toLowerCase() === createdByFilter.toLowerCase();
    const matchesDate = dateFilter === "all" || item.date.includes(dateFilter);
    return matchesSearch && matchesCreator && matchesDate;
  });

  function formatDate(value: string) {
    if (!value) return "01 Jul, 2022";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[34px] font-semibold leading-none text-slate-900">Attributes List</h2>
        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2952cc]"
        >
          {showForm ? "Close" : "Create Attributes"}
        </button>
      </div>

      {actionMessage ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {actionMessage}
        </div>
      ) : null}

      {showForm ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Name"
            />
            <input
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Description"
            />
            <input
              value={form.icon}
              onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Icon URL"
            />
            <input
              value={form.categoryIdsText}
              onChange={(event) => setForm((prev) => ({ ...prev, categoryIdsText: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Category IDs (comma separated)"
            />
            <input
              value={form.valuesText}
              onChange={(event) => setForm((prev) => ({ ...prev, valuesText: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Values (comma separated)"
            />
            <button
              type="button"
              disabled={pendingKey === "create-attribute"}
              onClick={createAttribute}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pendingKey === "create-attribute" ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      ) : null}

      {editingId ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
          <div className="mb-3 text-sm font-semibold text-[#1b3ea6]">Edit Attribute</div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto_auto] lg:items-end">
            <input
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Name"
            />
            <input
              value={editForm.description}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Description"
            />
            <input
              value={editForm.icon}
              onChange={(event) => setEditForm((prev) => ({ ...prev, icon: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Icon URL"
            />
            <input
              value={editForm.categoryIdsText}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, categoryIdsText: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Category IDs (comma separated)"
            />
            <input
              value={editForm.valuesText}
              onChange={(event) => setEditForm((prev) => ({ ...prev, valuesText: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Values (comma separated)"
            />
            <button
              type="button"
              disabled={pendingKey === `edit-${editingId}`}
              onClick={submitEditAttribute}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pendingKey === `edit-${editingId}` ? "Updating..." : "Update"}
            </button>
            <button
              type="button"
              onClick={() => setEditingId("")}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
            >
              Cancel
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
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-50/90 text-sm font-semibold text-slate-700">
            <tr>
              <th className="px-4 py-3">
                <input type="checkbox" aria-label="Select all attributes" />
              </th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Icon/ image</th>
              <th className="px-4 py-3">Attribute Name</th>
              <th className="px-4 py-3">Category IDs</th>
              <th className="px-4 py-3">Values</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {filteredAttributes.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  <input type="checkbox" aria-label={`Select attribute ${item.name}`} />
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
                <td className="px-4 py-3">{item.categoryIds.join(", ") || "-"}</td>
                <td className="px-4 py-3">{item.values.join(", ") || "-"}</td>
                <td className="px-4 py-3">{formatDate(item.date)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="text-slate-500 hover:text-brand"
                      disabled={pendingKey === `edit-${item.id}` || pendingKey === `get-${item.id}`}
                      onClick={() => startEditAttribute(item)}
                      aria-label={`Edit attribute ${item.name}`}
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
                      disabled={pendingKey === `delete-${item.id}`}
                      onClick={() => deleteAttribute(item.id)}
                      aria-label={`Delete attribute ${item.name}`}
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
        <button type="button" className="hover:text-brand">2</button>
        <button type="button" className="hover:text-brand">3</button>
        <span>...</span>
        <button type="button" className="hover:text-brand">120</button>
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
