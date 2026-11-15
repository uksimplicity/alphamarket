"use client";

import { useEffect, useState } from "react";
import { authGeneration, getAuth } from "@/components/auth/authStorage";
import { paymentError, responseData, orderPaymentStatus } from "./payments";
import { escrowStatusFromOrder } from "./escrow";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { orderPricing, type OrderPricing } from "./orderPricing";
import { accountStamp, checkAccount } from "./localAccountData";
import { orderDelivery } from "@/components/vendor/orderDelivery";

type Row = Record<string, unknown>;
function record(value: unknown): Row { return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {}; }
function text(value: unknown): string { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function amount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

export type BuyerOrder = {
  id: string; buyerId: string; status: string; paymentStatus: string; escrowStatus: string; vendor: string;
  total: number | null; address: string; createdAt: string;
  pricing: OrderPricing;
  delivery: ReturnType<typeof orderDelivery>;
  items: Array<{ id: string; name: string; qty: number; price: number | null }>;
};

export function parseBuyerOrder(payload: unknown): BuyerOrder | null {
  const data = record(responseData(payload));
  const row = record(data.order ?? data);
  const id = text(row.id ?? row.order_id ?? row.orderId ?? row.ID);
  if (!id) return null;
  const items = row.items ?? row.order_items ?? row.orderItems ?? row.Items;
  return {
    id, buyerId: text(row.buyer_id ?? row.buyerId ?? row.BuyerID ?? record(row.buyer).id),
    status: text(row.status ?? row.Status).toLowerCase() || "pending", paymentStatus: orderPaymentStatus(row), escrowStatus: escrowStatusFromOrder(row),
    vendor: text(row.seller_name ?? row.vendor_name ?? record(row.seller).name) || "Seller",
    total: orderPricing(row).buyerTotal, pricing: orderPricing(row), delivery: orderDelivery(row),
    address: text(row.dropoff_address ?? row.dropoffAddress ?? row.address ?? row.DeliveryAddress),
    createdAt: text(row.created_at ?? row.createdAt ?? row.CreatedAt),
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
  const user = useAuthUser();
  const generation = authGeneration();
  const key = `${user?.id || ""}:${generation}:${id || ""}`;
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [owner, setOwner] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    setLoading(true);
    setOwner(key);
    setError("");
    setOrders([]);
    setCheckedAt("");
    async function load() {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      setRefreshing(true);
      try {
        const stamp = accountStamp();
        const auth = getAuth();
        if (!auth?.access_token) throw new Error("Please sign in to view your orders.");
        const response = await fetch(id ? `/api/user/orders/${encodeURIComponent(id)}` : "/api/user/orders?limit=100&offset=0", {
          headers: { Authorization: `Bearer ${auth.access_token.replace(/^Bearer\s+/i, "").trim()}` },
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        const payload = await response.json();
        checkAccount(stamp);
        if (!response.ok || payload?.success === false) throw new Error(paymentError(payload, "Could not load your orders."));
        const data = responseData(payload);
        const root = record(data);
        const rows = id ? [data] : Array.isArray(data) ? data : root.orders ?? root.items ?? root.rows ?? [];
        const parsed = (Array.isArray(rows) ? rows : []).map(parseBuyerOrder).filter((order): order is BuyerOrder => order !== null);
        if (id && parsed.some(order => order.id !== id)) throw new Error("The returned order does not match this order.");
        if (!controller.signal.aborted) { setOrders(parsed); setError(""); setCheckedAt(new Date().toISOString()); }
      } catch (err) {
        if (!controller.signal.aborted) { setOrders([]); setCheckedAt(""); setError(err instanceof Error ? err.message : "Could not load your orders."); }
      } finally { inFlight = false; if (!controller.signal.aborted) { setLoading(false); setRefreshing(false); } }
    }
    void load();
    const visibleRefresh = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(visibleRefresh, 30000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", visibleRefresh); document.removeEventListener("visibilitychange", visibleRefresh); };
  }, [id, revision, key]);
  return { orders: owner === key ? orders : [], loading: owner !== key || loading, error: owner === key ? error : "", checkedAt: owner === key ? checkedAt : "", refreshing, reload: () => setRevision((value) => value + 1) };
}
