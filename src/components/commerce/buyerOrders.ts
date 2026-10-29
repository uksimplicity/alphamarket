"use client";

import { useEffect, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { paymentError, responseData, orderPaymentStatus } from "./payments";

type Row = Record<string, unknown>;
function record(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function text(value: unknown): string { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function amount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export type BuyerOrder = {
  id: string; status: string; paymentStatus: string; vendor: string;
  total: number | null; address: string; createdAt: string;
  items: Array<{ id: string; name: string; qty: number; price: number | null }>;
};

export function parseBuyerOrder(payload: unknown): BuyerOrder | null {
  const data = record(responseData(payload));
  const row = record(data.order ?? data);
  const id = text(row.id ?? row.order_id ?? row.orderId);
  if (!id) return null;
  const items = row.items ?? row.order_items ?? row.orderItems;
  return {
    id, status: text(row.status) || "pending", paymentStatus: orderPaymentStatus(row),
    vendor: text(row.seller_name ?? row.vendor_name ?? record(row.seller).name) || "Seller",
    total: amount(row.total_amount ?? row.totalAmount ?? row.total ?? row.amount),
    address: text(row.dropoff_address ?? row.dropoffAddress ?? row.address),
    createdAt: text(row.created_at ?? row.createdAt),
    items: (Array.isArray(items) ? items : []).map((value) => {
      const item = record(value), product = record(item.product);
      return {
        id: text(item.product_id ?? item.productId ?? product.id ?? item.id),
        name: text(item.product_name ?? item.name ?? product.name) || "Product",
        qty: Number(item.quantity ?? item.qty ?? 1),
        price: amount(item.unit_price ?? item.unitPrice ?? item.price),
      };
    }),
  };
}

export function useBuyerOrders(id?: string) {
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      setOrders([]);
      try {
        const auth = getAuth();
        if (!auth?.access_token) throw new Error("Please sign in to view your orders.");
        const response = await fetch(id ? `/api/user/orders/${encodeURIComponent(id)}` : "/api/user/orders?limit=100&offset=0", {
          headers: { Authorization: `Bearer ${auth.access_token.replace(/^Bearer\s+/i, "").trim()}` },
          cache: "no-store", signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || payload?.success === false) throw new Error(paymentError(payload, "Could not load your orders."));
        const data = responseData(payload);
        const root = record(data);
        const rows = id ? [data] : Array.isArray(data) ? data : root.orders ?? root.items ?? root.rows ?? [];
        const parsed = (Array.isArray(rows) ? rows : []).map(parseBuyerOrder).filter((order): order is BuyerOrder => order !== null);
        if (!controller.signal.aborted) setOrders(parsed);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Could not load your orders.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [id, revision]);
  return { orders, loading, error, reload: () => setRevision((value) => value + 1) };
}
