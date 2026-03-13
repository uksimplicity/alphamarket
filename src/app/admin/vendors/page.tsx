"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type Vendor = {
  id: string;
  name: string;
  status: string;
  store: string;
  performance: string;
};

export default function AdminVendorsPage() {
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => {
      const payload = await adminFetcher<unknown>("/grpc/users?limit=100");
      const rows = asArray(payload);

      return rows
        .map((row) => {
          const record = asRecord(row);
          const role = pickString(record, ["role", "userRole", "account_role"]).toLowerCase();
          const id = pickString(record, ["id", "user_id", "uuid"]);

          return {
            id,
            role,
            name: pickString(record, ["name", "full_name"]) ||
              `${pickString(record, ["first_name"])} ${pickString(record, ["last_name"])}`
                .trim() ||
              pickString(record, ["email"], "Unknown vendor"),
            status: pickString(record, ["status"], "pending"),
            store: pickString(record, ["store", "store_name", "business_name"], "No store name"),
            performance: pickString(record, ["performance", "rating", "score"], "No metrics"),
          } satisfies Vendor & { role: string };
        })
        .filter((vendor) => vendor.id)
        .filter((vendor) => vendor.role.includes("seller") || vendor.role.includes("vendor"));
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
        message={error instanceof Error ? error.message : "Failed to load vendors."}
        onRetry={refetch}
      />
    );
  }

  async function lookupByEmail() {
    if (!lookupEmail.trim()) return;
    try {
      setLookupLoading(true);
      const payload = await adminFetcher<unknown>(
        `/grpc/users/email?email=${encodeURIComponent(lookupEmail.trim())}`
      );
      setLookupResult(JSON.stringify(payload, null, 2));
    } catch (err) {
      setLookupResult(err instanceof Error ? err.message : "Lookup by email failed.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function lookupById() {
    if (!lookupId.trim()) return;
    try {
      setLookupLoading(true);
      const payload = await adminFetcher<unknown>(`/grpc/users/${lookupId.trim()}`);
      setLookupResult(JSON.stringify(payload, null, 2));
    } catch (err) {
      setLookupResult(err instanceof Error ? err.message : "Lookup by ID failed.");
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <Card>
      <SectionTitle title="Vendors" subtitle="Approve, suspend, and review metrics." />
      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[1fr_auto_1fr_auto]">
        <input
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          placeholder="Lookup user by email"
          value={lookupEmail}
          onChange={(event) => setLookupEmail(event.target.value)}
        />
        <Button variant="ghost" disabled={lookupLoading} onClick={lookupByEmail}>
          {lookupLoading ? "Looking up..." : "Lookup Email"}
        </Button>
        <input
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          placeholder="Lookup user by ID"
          value={lookupId}
          onChange={(event) => setLookupId(event.target.value)}
        />
        <Button variant="ghost" disabled={lookupLoading} onClick={lookupById}>
          {lookupLoading ? "Looking up..." : "Lookup ID"}
        </Button>
      </div>
      {lookupResult ? (
        <pre className="mt-3 max-h-56 overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
          {lookupResult}
        </pre>
      ) : null}
      <div className="mt-4 space-y-3 text-sm">
        {data.map((vendor) => (
          <div
            key={vendor.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div>
              <div className="font-semibold text-slate-800">{vendor.name}</div>
              <div className="text-xs text-slate-500">{vendor.store}</div>
            </div>
            <div className="text-xs text-slate-500">{vendor.performance}</div>
            <div className="text-xs font-semibold text-brand">{vendor.status}</div>
            <div className="flex gap-2">
              <Button variant="ghost">Suspend</Button>
              <Button>Approve</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
