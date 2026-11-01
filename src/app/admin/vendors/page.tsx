"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminFetcher } from "@/components/admin/api";
import { fetchAdminUsers } from "@/components/admin/users";
import { sellerAccounts } from "@/components/admin/sellerAccounts";
import { getSellerStoreProfileByOwner, subscribeStoreProfiles } from "@/components/store/storeProfileClient";
import UserAccountActions from "@/components/admin/UserAccountActions";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

export default function AdminVendorsPage() {
  const queryClient = useQueryClient();
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [lookupResult, setLookupResult] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  useEffect(() => subscribeStoreProfiles(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
  }), [queryClient]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async () => {
      const rows = await fetchAdminUsers();

      return sellerAccounts(rows).map((seller) => ({
        ...seller,
        store: seller.store || getSellerStoreProfileByOwner(seller.id, seller.email)?.name || "",
      }));
    },
    refetchInterval: 30_000,
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
      <SectionTitle title="Sellers" subtitle="Review seller details and manage account access." />
      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:grid-cols-[1fr_auto_1fr_auto]">
        <input
          className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          aria-label="Lookup seller by email"
          placeholder="Lookup user by email"
          value={lookupEmail}
          onChange={(event) => setLookupEmail(event.target.value)}
        />
        <Button variant="ghost" disabled={lookupLoading} onClick={lookupByEmail}>
          {lookupLoading ? "Looking up..." : "Lookup Email"}
        </Button>
        <input
          className="min-w-0 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
          aria-label="Lookup seller by ID"
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
        <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_6rem_18rem] items-center gap-5 rounded-lg bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 xl:grid">
          <div>Seller</div><div>Store</div><div>Status</div><div className="text-right">Actions</div>
        </div>
        {data.length === 0 ? (
          <p className="text-slate-500">No seller accounts found in the returned users.</p>
        ) : null}
        {data.map((vendor) => (
          <div
            key={vendor.id}
            data-seller-row
            className="grid min-w-0 gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_6rem_18rem] xl:items-center xl:gap-5"
          >
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <div className="font-semibold leading-6 text-slate-800">{vendor.name}</div>
              {vendor.email ? <a className="mt-1 block text-sm leading-5 text-slate-500 hover:text-brand" href={`mailto:${vendor.email}`}>{vendor.email}</a>
                : <p className="mt-1 text-sm text-slate-500">Email unavailable</p>}
            </div>
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <div className="mb-1 text-xs text-slate-400 xl:hidden">Store</div>
              <div className="leading-6 text-slate-700">{vendor.store || "Store name unavailable"}</div>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400 xl:hidden">Status</div>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${vendor.status === "active" ? "bg-green-50 text-green-700 ring-green-200" : vendor.status === "pending" ? "bg-orange-50 text-orange-700 ring-orange-200" : "bg-slate-100 text-slate-700 ring-slate-200"}`}>{vendor.status.replace(/_/g, " ")}</span>
            </div>
            <div className="min-w-0 sm:justify-self-end xl:w-full">
              <UserAccountActions id={vendor.id} email={vendor.email} status={vendor.status} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
