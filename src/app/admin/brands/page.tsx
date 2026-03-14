"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, authAdminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { getAuth } from "@/components/auth/authStorage";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type Brand = {
  id: string;
  name: string;
  description: string;
  website: string;
};

async function callBrandEndpoint<T>(path: string, init?: RequestInit): Promise<T> {
  const candidates = [() => authAdminFetcher<T>(path, init), () => adminFetcher<T>(path, init)];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return await candidate();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Brands endpoint unavailable.");
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminBrandsPage() {
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [createForm, setCreateForm] = useState({
    name: "",
    slug: "",
    description: "",
    websiteUrl: "",
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-brands-page"],
    queryFn: async () => {
      const payload = await callBrandEndpoint<unknown>("/brands?limit=100&offset=0");
      return asArray(payload).map((row, index) => {
        const record = asRecord(row);
        return {
          id: pickString(record, ["id", "uuid"], `brand-${index}`),
          name: pickString(record, ["name", "title"], "Unnamed brand"),
          description: pickString(record, ["description"], ""),
          website: pickString(record, ["website_url", "website"], ""),
        } satisfies Brand;
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
        message={error instanceof Error ? error.message : "Failed to load brands."}
        onRetry={refetch}
      />
    );
  }

  async function createBrand() {
    const name = createForm.name.trim();
    if (!name) {
      setActionMessage("Brand name is required.");
      return;
    }
    const payload: {
      name: string;
      slug: string;
      description: string;
      website_url?: string;
      media: { logo: string; banner: string };
    } = {
      name,
      slug: createForm.slug.trim() || toSlug(name),
      description: createForm.description.trim(),
      media: {
        logo: "",
        banner: "",
      },
    };
    if (createForm.websiteUrl.trim()) {
      payload.website_url = createForm.websiteUrl.trim();
    }
    try {
      setPendingKey("create-brand");
      setActionMessage("");
      const auth = getAuth();
      const token = auth?.access_token;

      async function uploadFile(file: File | null, folder = "brands") {
        if (!file) return "";
        if (!token) throw new Error("Authentication token missing for upload.");

        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", folder);
        const response = await fetch("/api/upload/file", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: fd,
        });
        const text = await response.text();
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        if (!response.ok) {
          const message =
            data && typeof data === "object" && "error" in data
              ? data.error
              : `File upload failed (${response.status}).`;
          throw new Error(String(message));
        }
        return (
          data?.url ||
          data?.file_url ||
          data?.path ||
          data?.data?.url ||
          data?.data?.file_url ||
          data?.data?.path ||
          ""
        );
      }

      payload.media.logo = await uploadFile(logoFile);
      payload.media.banner = await uploadFile(bannerFile);

      await callBrandEndpoint("/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setActionMessage("Brand created successfully.");
      setCreateForm({
        name: "",
        slug: "",
        description: "",
        websiteUrl: "",
      });
      setLogoFile(null);
      setBannerFile(null);
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to create brand.");
    } finally {
      setPendingKey("");
    }
  }

  async function editBrand(item: Brand) {
    const seed = {
      id: item.id,
      name: item.name,
      slug: toSlug(item.name),
      description: item.description,
      website_url: item.website,
    };
    const input = window.prompt("Update brand payload (JSON)", JSON.stringify(seed, null, 2));
    if (!input) return;
    try {
      setPendingKey(`edit-${item.id}`);
      setActionMessage("");
      await callBrandEndpoint(`/brands/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: input,
      });
      setActionMessage("Brand updated successfully.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update brand.");
    } finally {
      setPendingKey("");
    }
  }

  async function deleteBrand(id: string) {
    if (!window.confirm(`Delete brand ${id}?`)) return;
    try {
      setPendingKey(`delete-${id}`);
      setActionMessage("");
      await callBrandEndpoint(`/brands/${id}`, { method: "DELETE" });
      setActionMessage("Brand deleted successfully.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to delete brand.");
    } finally {
      setPendingKey("");
    }
  }

  return (
    <Card>
      <SectionTitle
        title="Brands"
        subtitle="Manage brand records."
        action={
          <Button onClick={() => setShowCreateForm((prev) => !prev)}>
            {showCreateForm ? "Close" : "Create Brands"}
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
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr]">
            <input
              value={createForm.name}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Brand Name"
            />
            <input
              value={createForm.slug}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, slug: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Slug (optional)"
            />
            <input
              value={createForm.websiteUrl}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, websiteUrl: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Website URL"
            />
            <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <div className="mb-1 text-xs text-slate-500">Brand Logo</div>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
            </label>
            <label className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <div className="mb-1 text-xs text-slate-500">Brand Banner</div>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={(event) => setBannerFile(event.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
            </label>
            <input
              value={createForm.description}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              placeholder="Description"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={pendingKey === "create-brand"}
              onClick={createBrand}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pendingKey === "create-brand" ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-4 space-y-3 text-sm">
        {data.length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-4 text-slate-500">No brands found.</div>
        ) : (
          data.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
              <div>
                <div className="font-semibold text-slate-800">{item.name}</div>
                <div className="text-xs text-slate-500">{item.website || item.description || "No details"}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" disabled={pendingKey === `edit-${item.id}`} onClick={() => editBrand(item)}>
                  Edit
                </Button>
                <Button disabled={pendingKey === `delete-${item.id}`} onClick={() => deleteBrand(item.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
