"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

export default function AdminOrdersPage() {
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [orderFilters, setOrderFilters] = useState({
    buyerId: "",
    sellerId: "",
    status: "",
  });
  const [orderLookupId, setOrderLookupId] = useState("");
  const [orderLookupResult, setOrderLookupResult] = useState("");
  const [sellerStatusForm, setSellerStatusForm] = useState({
    sellerId: "",
    orderId: "",
    status: "processing",
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const [pendingPayload, timedOutPayload] = await Promise.all([
        adminFetcher<unknown>("/escrows/pending?limit=50"),
        adminFetcher<unknown>("/escrows/timed-out?limit=50"),
      ]);

      const pending = asArray(pendingPayload).map((row) => ({
        row,
        source: "pending" as const,
      }));
      const timedOut = asArray(timedOutPayload).map((row) => ({
        row,
        source: "timed_out" as const,
      }));

      return [...pending, ...timedOut].map(({ row, source }) => {
        const record = asRecord(row);
        const status =
          pickString(record, ["status", "state"], source === "pending" ? "pending" : "timed_out");
        const loweredStatus = status.toLowerCase();

        return {
          id: pickString(record, ["id", "order_id", "escrow_id", "reference"], "Unknown"),
          customer: pickString(
            record,
            ["customer", "customer_name", "buyer_name", "buyer_email", "user_email"],
            "Customer unavailable"
          ),
          status,
          dispute: loweredStatus.includes("dispute") || source === "timed_out",
          refund: loweredStatus.includes("refund") || loweredStatus.includes("reverse"),
        };
      });
    },
  });

  const {
    data: ordersData,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["admin-orders-general", orderFilters],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (orderFilters.buyerId.trim()) params.set("buyer_id", orderFilters.buyerId.trim());
      if (orderFilters.sellerId.trim()) params.set("seller_id", orderFilters.sellerId.trim());
      if (orderFilters.status.trim()) params.set("status", orderFilters.status.trim());

      const payload = await adminFetcher<unknown>(`/orders?${params.toString()}`);
      return asArray(payload).map((row, index) => {
        const record = asRecord(row);
        return {
          id: pickString(record, ["id", "order_id", "uuid"], `order-${index}`),
          buyer: pickString(record, ["buyer_id", "buyer_email", "customer", "customer_name"], "-"),
          seller: pickString(record, ["seller_id", "seller_email", "seller_name"], "-"),
          status: pickString(record, ["status", "state"], "unknown"),
          total: pickString(record, ["total", "amount", "subtotal"], "0"),
        };
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
        message={error instanceof Error ? error.message : "Failed to load orders."}
        onRetry={refetch}
      />
    );
  }

  async function runEscrowAction(id: string, action: "release" | "reverse") {
    if (!id || id === "Unknown") return;

    try {
      setActionError("");
      setPendingOrderId(id);

      const notes = window.prompt(
        action === "release"
          ? "Optional release notes:"
          : "Reversal notes (required by backend in many setups):",
        ""
      );
      const payload =
        action === "reverse" ? { notes: notes || "Reversed by admin" } : notes ? { notes } : {};

      await adminFetcher(`/escrows/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Escrow action failed.");
    } finally {
      setPendingOrderId(null);
    }
  }

  async function lookupOrderById() {
    if (!orderLookupId.trim()) {
      setActionError("Enter order ID to fetch details.");
      return;
    }
    try {
      setActionError("");
      setPendingOrderId(`lookup-${orderLookupId}`);
      const payload = await adminFetcher<unknown>(`/orders/${orderLookupId.trim()}`);
      setOrderLookupResult(JSON.stringify(payload, null, 2));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to fetch order details.");
    } finally {
      setPendingOrderId(null);
    }
  }

  async function updateSellerOrderStatus() {
    if (!sellerStatusForm.sellerId.trim() || !sellerStatusForm.orderId.trim()) {
      setActionError("Seller ID and Order ID are required.");
      return;
    }

    try {
      setActionError("");
      setPendingOrderId(`status-${sellerStatusForm.orderId}`);
      await adminFetcher(
        `/seller/orders/${encodeURIComponent(
          sellerStatusForm.orderId.trim()
        )}/status?seller_id=${encodeURIComponent(sellerStatusForm.sellerId.trim())}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: sellerStatusForm.status }),
        }
      );
      setActionError("Order status updated successfully.");
      await refetchOrders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update order status.");
    } finally {
      setPendingOrderId(null);
    }
  }

  return (
    <Card>
      <SectionTitle title="Orders" subtitle="Disputes, refunds, and status updates." />
      {actionError ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}
      <div className="mt-4 space-y-3 text-sm">
        {data.map((order) => (
          <div
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div>
              <div className="font-semibold text-slate-800">Order {order.id}</div>
              <div className="text-xs text-slate-500">{order.customer}</div>
            </div>
            <div className="text-xs text-slate-500">{order.status}</div>
            <div className="text-xs text-slate-500">
              {order.dispute ? "Dispute" : "No dispute"}
            </div>
            <div className="text-xs text-slate-500">
              {order.refund ? "Refunded" : "No refund"}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={pendingOrderId === order.id || order.id === "Unknown"}
                onClick={() => runEscrowAction(order.id, "release")}
              >
                {pendingOrderId === order.id ? "Updating..." : "Release"}
              </Button>
              <Button
                disabled={pendingOrderId === order.id || order.id === "Unknown"}
                onClick={() => runEscrowAction(order.id, "reverse")}
              >
                {pendingOrderId === order.id ? "Updating..." : "Reverse"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-t border-slate-200 pt-6">
        <SectionTitle title="Marketplace Orders" subtitle="Admin order listing, detail, and status updates." />
        {ordersError ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {ordersError instanceof Error ? ordersError.message : "Failed to load order list."}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="buyer_id"
            value={orderFilters.buyerId}
            onChange={(event) =>
              setOrderFilters((prev) => ({ ...prev, buyerId: event.target.value }))
            }
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="seller_id"
            value={orderFilters.sellerId}
            onChange={(event) =>
              setOrderFilters((prev) => ({ ...prev, sellerId: event.target.value }))
            }
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="status"
            value={orderFilters.status}
            onChange={(event) =>
              setOrderFilters((prev) => ({ ...prev, status: event.target.value }))
            }
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="ghost" onClick={() => refetchOrders()}>
            {ordersLoading ? "Loading..." : "Refresh Orders"}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setOrderFilters({
                buyerId: "",
                sellerId: "",
                status: "",
              })
            }
          >
            Reset Filters
          </Button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          {(ordersData ?? []).map((row) => (
            <div
              key={row.id}
              className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-5"
            >
              <div>{row.id}</div>
              <div>{row.buyer}</div>
              <div>{row.seller}</div>
              <div>{row.status}</div>
              <div>{row.total}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="order_id"
            value={orderLookupId}
            onChange={(event) => setOrderLookupId(event.target.value)}
          />
          <Button
            variant="ghost"
            disabled={pendingOrderId === `lookup-${orderLookupId}`}
            onClick={lookupOrderById}
          >
            Get Order Details
          </Button>
        </div>
        <pre className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          {orderLookupResult || "Order detail response will appear here."}
        </pre>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="seller_id"
            value={sellerStatusForm.sellerId}
            onChange={(event) =>
              setSellerStatusForm((prev) => ({ ...prev, sellerId: event.target.value }))
            }
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="order_id"
            value={sellerStatusForm.orderId}
            onChange={(event) =>
              setSellerStatusForm((prev) => ({ ...prev, orderId: event.target.value }))
            }
          />
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="status"
            value={sellerStatusForm.status}
            onChange={(event) =>
              setSellerStatusForm((prev) => ({ ...prev, status: event.target.value }))
            }
          />
        </div>
        <div className="mt-3">
          <Button
            disabled={pendingOrderId === `status-${sellerStatusForm.orderId}`}
            onClick={updateSellerOrderStatus}
          >
            Update Seller Order Status
          </Button>
        </div>
      </div>
    </Card>
  );
}
