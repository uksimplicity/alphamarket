"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, SectionTitle } from "@/components/dashboard/ui";

import AdminEscrowPanel from "@/components/admin/AdminEscrowPanel";

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
          total: pickString(record, ["total_amount", "totalAmount", "total", "amount", "subtotal"], "Not reported"),
        };
      });
    },
  });

  async function lookupOrderById() {
    if (!orderLookupId.trim()) {
      setActionError("Enter order ID to fetch details.");
      return;
    }
    try {
      setActionError("");
      setPendingOrderId(`lookup-${orderLookupId}`);
      const payload = await adminFetcher<unknown>(`/orders/${encodeURIComponent(orderLookupId.trim())}`);
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
    <div className="grid gap-6">
      <AdminEscrowPanel />
      <Card>
      <div>
        {actionError ? <p role="status" className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{actionError}</p> : null}
        <SectionTitle title="All platform orders" subtitle="Orders across user categories, with optional buyer, seller and status filters." />
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
    </div>
  );
}
