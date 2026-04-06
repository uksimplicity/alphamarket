"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminDeliveriesPage() {
  const [filters, setFilters] = useState({ status: "", riderId: "" });
  const [lookupId, setLookupId] = useState("");
  const [assignForm, setAssignForm] = useState({ deliveryId: "", riderId: "" });
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-deliveries", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20", offset: "0" });
      if (filters.status.trim()) params.set("status", filters.status.trim());
      if (filters.riderId.trim()) params.set("rider_id", filters.riderId.trim());

      const payload = await adminFetcher<unknown>(`/deliveries?${params.toString()}`);
      return asArray(payload).map((row, index) => {
        const record = asRecord(row);
        return {
          id: pickString(record, ["id", "delivery_id"], `delivery-${index}`),
          orderId: pickString(record, ["order_id", "orderID"], "-"),
          riderId: pickString(record, ["rider_id", "riderID"], "-"),
          status: pickString(record, ["status"], "unknown"),
        };
      });
    },
  });

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

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load deliveries."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="Deliveries" subtitle="Monitor and filter admin delivery queue." />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="status" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="rider_id" value={filters.riderId} onChange={(event) => setFilters((prev) => ({ ...prev, riderId: event.target.value }))} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => refetch()}>Apply Filters</Button>
          <Button variant="ghost" onClick={() => setFilters({ status: "", riderId: "" })}>Reset</Button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {data?.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-4">
              <div>{row.id}</div>
              <div>{row.orderId}</div>
              <div>{row.riderId}</div>
              <div>{row.status}</div>
            </div>
          ))}
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
