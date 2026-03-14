"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetcher, authAdminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type Tag = {
  id: string;
  name: string;
  description: string;
  slug: string;
};

function extractTagRecords(payload: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const visited = new WeakSet<object>();

  function walk(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (visited.has(value as object)) return;
    visited.add(value as object);

    const record = asRecord(value);
    if (!record) return;

    const hasId =
      typeof record.id === "string" ||
      typeof record.id === "number" ||
      typeof record.uuid === "string";
    const hasName =
      typeof record.name === "string" ||
      typeof record.title === "string" ||
      typeof record.tag === "string" ||
      typeof record.label === "string";

    if (hasId && hasName) {
      found.push(record);
    }

    Object.values(record).forEach(walk);
  }

  walk(payload);
  return found;
}

async function callTagEndpoint<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const candidates =
    method === "GET"
      ? [() => adminFetcher<T>(path, init), () => authAdminFetcher<T>(path, init)]
      : [() => authAdminFetcher<T>(path, init), () => adminFetcher<T>(path, init)];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return await candidate();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Tags endpoint unavailable.");
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [tagOverrides, setTagOverrides] = useState<Record<string, Partial<Tag>>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    slug: "",
    description: "",
  });
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    description: "",
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-tags-page"],
    queryFn: async () => {
      const payload = await callTagEndpoint<unknown>("/tags?limit=100&offset=0");
      const discovered = extractTagRecords(payload);
      const rows = discovered.length
        ? discovered
        : asArray(payload).map((row) => asRecord(row)).filter(Boolean) as Record<string, unknown>[];

      const mapped = rows.map((record, index) => {
        const fallbackSlug = pickString(record, ["slug", "tag_slug"], "");
        const slugNameFallback = fallbackSlug
          ? fallbackSlug
              .replace(/[-_]+/g, " ")
              .replace(/\b\w/g, (char) => char.toUpperCase())
          : "Unnamed tag";
        const name = pickString(
          record,
          ["name", "title", "tag", "label", "tag_name"],
          slugNameFallback
        );
        return {
          id: pickString(record, ["id", "uuid"], `tag-${index}`),
          name: pickString(record, ["name", "title", "tag", "label", "tag_name", "tagName"], name),
          description: pickString(record, ["description", "details"], ""),
          slug: pickString(record, ["slug", "tag_slug"], toSlug(name)),
        } satisfies Tag;
      });

      const needsEnrichment = mapped.filter((item) => item.name === "Unnamed tag" && !item.id.startsWith("tag-"));
      if (needsEnrichment.length === 0) return mapped;

      const enriched = await Promise.all(
        mapped.map(async (item) => {
          if (item.name !== "Unnamed tag" || item.id.startsWith("tag-")) return item;
          try {
            const details = await callTagEndpoint<unknown>(`/tags/${item.id}`);
            const record = asRecord(details);
            if (!record) return item;
            const name = pickString(
              record,
              ["name", "title", "tag", "label", "tag_name", "tagName"],
              item.name
            );
            return {
              ...item,
              name,
              description: pickString(record, ["description", "details"], item.description),
              slug: pickString(record, ["slug", "tag_slug"], item.slug || toSlug(name)),
            } satisfies Tag;
          } catch {
            return item;
          }
        })
      );

      return enriched;
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
        message={error instanceof Error ? error.message : "Failed to load tags."}
        onRetry={refetch}
      />
    );
  }

  async function createTag() {
    const name = createForm.name.trim();
    if (!name) {
      setActionMessage("Tag name is required.");
      return;
    }
    const payload = {
      name,
      slug: createForm.slug.trim() || toSlug(name),
      description: createForm.description.trim(),
    };
    try {
      setPendingKey("create-tag");
      setActionMessage("");
      await callTagEndpoint("/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setTagOverrides((prev) => ({
        ...prev,
        [`temp-${Date.now()}`]: {
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
        },
      }));
      setActionMessage("Tag created successfully.");
      setCreateForm({ name: "", slug: "", description: "" });
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to create tag.");
    } finally {
      setPendingKey("");
    }
  }

  async function editTag(item: Tag) {
    let seed = { id: item.id, name: item.name, slug: item.slug, description: item.description };
    try {
      const details = await callTagEndpoint<unknown>(`/tags/${item.id}`);
      const record = asRecord(details);
      if (record) {
        const name = pickString(record, ["name", "title", "tag", "label", "tag_name"], item.name);
        seed = {
          id: pickString(record, ["id", "uuid"], item.id),
          name,
          slug: pickString(record, ["slug", "tag_slug"], item.slug || toSlug(name)),
          description: pickString(record, ["description", "details"], item.description),
        };
      }
    } catch {
      // Keep local seed if details endpoint fails.
    }
    setEditingId(item.id);
    setEditForm({
      name: seed.name,
      slug: seed.slug,
      description: seed.description,
    });
  }

  async function submitTagEdit() {
    if (!editingId) return;
    const name = editForm.name.trim();
    if (!name) {
      setActionMessage("Tag name is required.");
      return;
    }
    const payload = {
      id: editingId,
      name,
      slug: editForm.slug.trim() || toSlug(name),
      description: editForm.description.trim(),
    };
    try {
      setPendingKey(`edit-${editingId}`);
      setActionMessage("");
      await callTagEndpoint(`/tags/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      queryClient.setQueryData<Tag[]>(["admin-tags-page"], (prev = []) =>
        prev.map((tag) =>
          tag.id === editingId
            ? {
                ...tag,
                name: payload.name,
                slug: payload.slug,
                description: payload.description,
              }
            : tag
        )
      );
      setTagOverrides((prev) => ({
        ...prev,
        [editingId]: {
          name: payload.name,
          slug: payload.slug,
          description: payload.description,
        },
      }));
      setActionMessage("Tag updated successfully.");
      setEditingId("");
      setEditForm({ name: "", slug: "", description: "" });
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update tag.");
    } finally {
      setPendingKey("");
    }
  }

  async function deleteTag(id: string) {
    if (!window.confirm(`Delete tag ${id}?`)) return;
    try {
      setPendingKey(`delete-${id}`);
      setActionMessage("");
      await callTagEndpoint(`/tags/${id}`, { method: "DELETE" });
      setActionMessage("Tag deleted successfully.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to delete tag.");
    } finally {
      setPendingKey("");
    }
  }

  return (
    <Card>
      <SectionTitle
        title="Tags"
        subtitle="Manage product tags."
        action={
          <Button onClick={() => setShowCreateForm((prev) => !prev)}>
            {showCreateForm ? "Close" : "Create Tags"}
          </Button>
        }
      />
      {actionMessage ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {actionMessage}
        </div>
      ) : null}
      {showCreateForm ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end">
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Tag Name"
            />
            <input
              value={createForm.slug}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, slug: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Slug (optional)"
            />
            <input
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Description"
            />
            <button
              type="button"
              disabled={pendingKey === "create-tag"}
              onClick={createTag}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pendingKey === "create-tag" ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      ) : null}
      {editingId ? (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
          <div className="mb-3 text-sm font-semibold text-[#1b3ea6]">Edit Tag</div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
            <input
              value={editForm.name}
              onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Tag Name"
            />
            <input
              value={editForm.slug}
              onChange={(event) => setEditForm((prev) => ({ ...prev, slug: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Slug (optional)"
            />
            <input
              value={editForm.description}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Description"
            />
            <button
              type="button"
              disabled={pendingKey === `edit-${editingId}`}
              onClick={submitTagEdit}
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
      <div className="mt-4 space-y-3 text-sm">
        {(data.length === 0 ? [] : data.map((tag) => ({ ...tag, ...(tagOverrides[tag.id] ?? {}) }))).length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-4 text-slate-500">No tags found.</div>
        ) : (
          data.map((raw) => {
            const item = { ...raw, ...(tagOverrides[raw.id] ?? {}) } as Tag;
            return (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div>
                <div className="font-semibold text-slate-800">{item.name}</div>
                <div className="text-xs text-slate-500">{item.slug}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" disabled={pendingKey === `edit-${item.id}`} onClick={() => editTag(item)}>
                  Edit
                </Button>
                <Button disabled={pendingKey === `delete-${item.id}`} onClick={() => deleteTag(item.id)}>
                  Delete
                </Button>
              </div>
            </div>
          )})
        )}
      </div>
    </Card>
  );
}
