"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type PromotionsData = {
  banners: Array<{ id: string; title: string; status: string }>;
  featured: Array<{ id: string; type: string; name: string }>;
  cms: Array<{ id: string; title: string; status: string }>;
};

export default function AdminPromotionsPage() {
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");

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

  async function createEntity(type: "brands" | "categories" | "tags") {
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
          title="Categories"
          subtitle="Featured catalog categories."
          action={
            <Button
              disabled={pendingKey === "create-categories"}
              onClick={() => createEntity("categories")}
            >
              {pendingKey === "create-categories" ? "Creating..." : "Add Category"}
            </Button>
          }
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.featured.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{item.name}</div>
                <div className="text-xs text-slate-500">{item.type}</div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={pendingKey === `get-categories-${item.id}`}
                  onClick={() => getEntity("categories", item.id)}
                >
                  View
                </Button>
                <Button
                  variant="ghost"
                  disabled={pendingKey === `put-categories-${item.id}`}
                  onClick={() => updateEntity("categories", item.id, item.name)}
                >
                  Edit
                </Button>
                <Button
                  disabled={pendingKey === `delete-categories-${item.id}`}
                  onClick={() => deleteEntity("categories", item.id)}
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
