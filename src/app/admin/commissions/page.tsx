"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type CommissionRow = {
  id: string;
  riderId: string;
  orderId: string;
  deliveryId: string;
  status: string;
  amount: string;
};

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminCommissionsPage() {
  const [filters, setFilters] = useState({ status: "", riderId: "", orderId: "", deliveryId: "" });
  const [selectedId, setSelectedId] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedRiderId, setSelectedRiderId] = useState("");
  const [lookupResult, setLookupResult] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [markPaid, setMarkPaid] = useState({ commissionId: "", ledgerEntryId: "" });
  const [createPayload, setCreatePayload] = useState({ riderID: "", orderID: "", deliveryID: "", deliveryFee: "", source: "marketplace" });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-commissions", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "20", offset: "0" });
      if (filters.status.trim()) params.set("status", filters.status.trim());
      if (filters.riderId.trim()) params.set("rider_id", filters.riderId.trim());
      if (filters.orderId.trim()) params.set("order_id", filters.orderId.trim());
      if (filters.deliveryId.trim()) params.set("delivery_id", filters.deliveryId.trim());

      const payload = await adminFetcher<unknown>(`/commissions?${params.toString()}`);
      const rows = asArray(payload);
      return rows.map((row, index) => {
        const record = asRecord(row);
        return {
          id: pickString(record, ["id", "commission_id", "uuid"], `commission-${index}`),
          riderId: pickString(record, ["rider_id", "riderID"], "-"),
          orderId: pickString(record, ["order_id", "orderID"], "-"),
          deliveryId: pickString(record, ["delivery_id", "deliveryID"], "-"),
          status: pickString(record, ["status"], "unknown"),
          amount: pickString(record, ["commission_amt", "amount", "deliveryFee"], "0"),
        } satisfies CommissionRow;
      });
    },
  });

  async function runLookup(path: string) {
    try {
      setActionMessage("");
      const payload = await adminFetcher<unknown>(path);
      setLookupResult(pretty(payload));
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Lookup failed.");
    }
  }

  async function createCommission() {
    try {
      setActionMessage("");
      await adminFetcher("/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          riderID: createPayload.riderID.trim(),
          orderID: createPayload.orderID.trim(),
          deliveryID: createPayload.deliveryID.trim(),
          deliveryFee: Number(createPayload.deliveryFee || 0),
          source: createPayload.source,
        }),
      });
      setActionMessage("Commission created.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to create commission.");
    }
  }

  async function patchCommission() {
    if (!selectedId.trim()) {
      setActionMessage("Enter commission ID to update.");
      return;
    }
    const seed = { status: "paid", commission_rate: 0, commission_amt: 0, ledger_entry_id: "" };
    const input = window.prompt("Update commission payload (JSON)", JSON.stringify(seed, null, 2));
    if (!input) return;

    try {
      setActionMessage("");
      await adminFetcher(`/commissions/${selectedId.trim()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: input,
      });
      setActionMessage("Commission updated.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update commission.");
    }
  }

  async function markCommissionPaid() {
    if (!markPaid.commissionId.trim() || !markPaid.ledgerEntryId.trim()) {
      setActionMessage("Commission ID and Ledger Entry ID are required.");
      return;
    }

    try {
      setActionMessage("");
      await adminFetcher(`/commissions/${markPaid.commissionId.trim()}/mark-paid`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ledger_entry_id: markPaid.ledgerEntryId.trim() }),
      });
      setActionMessage("Commission marked as paid.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to mark commission as paid.");
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
        message={error instanceof Error ? error.message : "Failed to load commissions."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="Commissions" subtitle="Manage rider commissions and payment lifecycle." />
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="status" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="rider_id" value={filters.riderId} onChange={(event) => setFilters((prev) => ({ ...prev, riderId: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="order_id" value={filters.orderId} onChange={(event) => setFilters((prev) => ({ ...prev, orderId: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="delivery_id" value={filters.deliveryId} onChange={(event) => setFilters((prev) => ({ ...prev, deliveryId: event.target.value }))} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => refetch()}>Apply Filters</Button>
          <Button variant="ghost" onClick={() => setFilters({ status: "", riderId: "", orderId: "", deliveryId: "" })}>Reset</Button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          {data?.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-6">
              <div>{row.id}</div>
              <div>{row.riderId}</div>
              <div>{row.orderId}</div>
              <div>{row.deliveryId}</div>
              <div>{row.status}</div>
              <div>{row.amount}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Commission Lookups" subtitle="Single-record and rider breakdown lookups." />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="flex gap-2">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="commission_id" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} />
            <Button variant="ghost" onClick={() => runLookup(`/commissions/${selectedId.trim()}`)}>Get</Button>
          </div>
          <div className="flex gap-2">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="delivery_id" value={selectedDeliveryId} onChange={(event) => setSelectedDeliveryId(event.target.value)} />
            <Button variant="ghost" onClick={() => runLookup(`/commissions/delivery/${selectedDeliveryId.trim()}`)}>By Delivery</Button>
          </div>
          <div className="flex gap-2">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="order_id" value={selectedOrderId} onChange={(event) => setSelectedOrderId(event.target.value)} />
            <Button variant="ghost" onClick={() => runLookup(`/commissions/order/${selectedOrderId.trim()}`)}>By Order</Button>
          </div>
          <div className="flex gap-2">
            <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="rider_id" value={selectedRiderId} onChange={(event) => setSelectedRiderId(event.target.value)} />
            <Button variant="ghost" onClick={() => runLookup(`/commissions/rider/${selectedRiderId.trim()}?limit=20&offset=0`)}>By Rider</Button>
          </div>
        </div>
        <div className="mt-3">
          <Button variant="ghost" onClick={() => runLookup(`/commissions/rider/${selectedRiderId.trim()}/summary`)}>Rider Summary</Button>
        </div>
        <pre className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{lookupResult || "Lookup response will appear here."}</pre>
      </Card>

      <Card>
        <SectionTitle title="Write Actions" subtitle="Create, patch, and mark commissions as paid." />
        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="riderID" value={createPayload.riderID} onChange={(event) => setCreatePayload((prev) => ({ ...prev, riderID: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="orderID" value={createPayload.orderID} onChange={(event) => setCreatePayload((prev) => ({ ...prev, orderID: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="deliveryID" value={createPayload.deliveryID} onChange={(event) => setCreatePayload((prev) => ({ ...prev, deliveryID: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="deliveryFee" value={createPayload.deliveryFee} onChange={(event) => setCreatePayload((prev) => ({ ...prev, deliveryFee: event.target.value }))} />
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={createPayload.source} onChange={(event) => setCreatePayload((prev) => ({ ...prev, source: event.target.value }))}>
            <option value="marketplace">marketplace</option>
            <option value="rider_app">rider_app</option>
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          <Button onClick={createCommission}>Create Commission</Button>
          <Button variant="ghost" onClick={patchCommission}>Patch Commission ({selectedId || "set id above"})</Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="commission_id" value={markPaid.commissionId} onChange={(event) => setMarkPaid((prev) => ({ ...prev, commissionId: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="ledger_entry_id" value={markPaid.ledgerEntryId} onChange={(event) => setMarkPaid((prev) => ({ ...prev, ledgerEntryId: event.target.value }))} />
          <Button onClick={markCommissionPaid}>Mark Paid</Button>
        </div>

        {actionMessage ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{actionMessage}</div>
        ) : null}
      </Card>
    </div>
  );
}
