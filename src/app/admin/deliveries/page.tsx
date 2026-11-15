"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

import { deliveryStatuses, loadAdminDeliveries, searchDeliveries, type DeliveryFilters } from "@/components/admin/deliveryData";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { authGeneration } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
const emptyFilters: DeliveryFilters = { status: "", riderId: "", orderId: "" };

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminDeliveriesPage() {
  const user = useAuthUser();
  const [draft, setDraft] = useState<DeliveryFilters>(emptyFilters);
  const [filters, setFilters] = useState<DeliveryFilters>(emptyFilters);
  const [lookupId, setLookupId] = useState("");
  const [assignForm, setAssignForm] = useState({ deliveryId: "", riderId: "" });
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-deliveries", user?.id, authGeneration(), filters.status, filters.riderId],
    enabled: !!user?.id,
    queryFn: async ({ signal }) => {
      const stamp = accountStamp();
      return loadAdminDeliveries(async path => {
        checkAccount(stamp);
        const payload = await adminFetcher<unknown>(path, { signal });
        checkAccount(stamp);
        return payload;
      }, filters);
    },
  });
  const visible = searchDeliveries(data || [], filters.orderId);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { status: draft.status, riderId: draft.riderId.trim(), orderId: draft.orderId.trim() };
    setFilters(next);
    if (next.status === filters.status && next.riderId === filters.riderId) void refetch();
  }

  function resetFilters() {
    setDraft(emptyFilters);
    setFilters(emptyFilters);
    if (!filters.status && !filters.riderId) void refetch();
  }

  async function lookupDelivery() {
    if (!lookupId.trim()) {
      setMessage("Enter delivery ID.");
      return;
    }
    try {
      setMessage("");
      const payload = await adminFetcher<unknown>(`/deliveries/${lookupId.trim()}`);
      setResult(pretty(payload));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to fetch delivery.");
    }
  }

  async function assignRider() {
    if (!assignForm.deliveryId.trim() || !assignForm.riderId.trim()) {
      setMessage("Delivery ID and Rider ID are required.");
      return;
    }

    try {
      setMessage("");
      const payload = await adminFetcher<unknown>(`/deliveries/${assignForm.deliveryId.trim()}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rider_id: assignForm.riderId.trim() }),
      });
      setResult(pretty(payload));
      setMessage("Rider assigned successfully.");
      await refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to assign rider.");
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="Deliveries" subtitle="Monitor and filter admin delivery queue." />
        <form onSubmit={applyFilters}>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-sm">Order ID or reference
              <input className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm" name="orderId" placeholder="Enter the marketplace order ID" value={draft.orderId} onChange={event => setDraft(previous => ({ ...previous, orderId: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-sm">Delivery status
              <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" name="status" value={draft.status} onChange={event => setDraft(previous => ({ ...previous, status: event.target.value }))}>
                <option value="">All statuses</option>
                {deliveryStatuses.map(status => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm">Rider ID
              <input className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm" name="riderId" placeholder="Any rider" value={draft.riderId} onChange={event => setDraft(previous => ({ ...previous, riderId: event.target.value }))} />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" disabled={isFetching}>{isFetching ? "Loading..." : "Apply Filters"}</Button>
            <Button type="button" variant="ghost" onClick={resetFilters} disabled={isFetching}>Reset</Button>
          </div>
        </form>
        <div className="mt-4 space-y-3 text-sm">
          {isLoading ? <Skeleton className="h-20" /> : error ? <ErrorState message={error instanceof Error ? error.message : "Failed to load deliveries."} onRetry={refetch} /> : <>
            <p role="status">{visible.length ? `${visible.length} deliveries found.` : "No deliveries match the applied filters."}</p>
            {visible.length ? <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead><tr><th className="p-3">Delivery ID</th><th className="p-3">Order ID</th><th className="p-3">Rider ID</th><th className="p-3">Status</th></tr></thead>
                <tbody>{visible.map(row => <tr key={row.id} className="border-t border-slate-200">
                  <td className="break-all p-3">{row.id}</td><td className="break-all p-3">{row.orderId || row.orderNumber || "Not reported"}</td>
                  <td className="break-all p-3">{row.riderId || "Not assigned"}</td><td className="p-3">{row.status.replaceAll("_", " ")}</td>
                </tr>)}</tbody>
              </table>
            </div> : null}
          </>}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Delivery Lookup" subtitle="Fetch one delivery by ID." />
        <div className="mt-3 flex gap-2">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="delivery id" value={lookupId} onChange={(event) => setLookupId(event.target.value)} />
          <Button variant="ghost" onClick={lookupDelivery}>Get Delivery</Button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Assign Rider" subtitle="Assign a rider to a delivery." />
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="delivery_id" value={assignForm.deliveryId} onChange={(event) => setAssignForm((prev) => ({ ...prev, deliveryId: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="rider_id" value={assignForm.riderId} onChange={(event) => setAssignForm((prev) => ({ ...prev, riderId: event.target.value }))} />
          <Button onClick={assignRider}>Assign</Button>
        </div>

        {message ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{message}</div>
        ) : null}
        <pre className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{result || "Response will appear here."}</pre>
      </Card>
    </div>
  );
}
