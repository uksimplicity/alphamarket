"use client";
import { useEffect, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "./localAccountData";
import { orderPricing, checkoutPricing, type OrderPricing } from "./orderPricing";

export function useCheckoutPricing(orderIds: string[], cartKey?: string, createdOrders?: unknown[]) {
  const user = useAuthUser(), idsKey = JSON.stringify(orderIds);
  const createdKey = JSON.stringify(createdOrders ?? []);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; pricing: OrderPricing | null; loading: boolean; error: string }>({ key: "", pricing: null, loading: false, error: "" });
  const key = user?.id + ":" + idsKey + ":" + (cartKey ?? "") + ":" + createdKey;
  useEffect(() => {
    const controller = new AbortController();
    const ids: string[] = JSON.parse(idsKey);
    if (!ids.length) return () => controller.abort();
    const auth = getAuth();
    setState({ key, pricing: null, loading: true, error: "" });
    async function load() {
      try {
        if (!auth?.user.id) throw new Error("Please sign in to review your order.");
        const stamp = accountStamp(), values: OrderPricing[] = [];
        for (const id of ids) {
          const response = await fetch("/api/user/orders/" + encodeURIComponent(id), { cache: "no-store", redirect: "error", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]), headers: { Authorization: "Bearer " + auth.access_token.replace(/^Bearer\s+/i, "").trim(), Accept: "application/json" } });
          const payload = await response.json();
          checkAccount(stamp);
          if (!response.ok || payload?.success === false) throw new Error(payload?.error || "The order total could not be loaded.");
          const data = payload?.data ?? payload, order = data?.order ?? data;
          const buyerId = order?.buyer_id ?? order?.buyerId ?? order?.BuyerID;
          if (!order || (order.id ?? order.order_id ?? order.orderId ?? order.ID) !== id || buyerId && buyerId !== auth.user.id) throw new Error("The returned order does not match your checkout.");
          const savedOrders: unknown[] = JSON.parse(createdKey);
          const saved = savedOrders.find(value => {
            if (!value || typeof value !== "object" || Array.isArray(value)) return false;
            const entry = value as Record<string, unknown>;
            const owner = entry.buyer_id ?? entry.buyerId ?? entry.BuyerID;
            return (entry.id ?? entry.order_id ?? entry.orderId ?? entry.ID) === id && (!owner || owner === auth!.user.id);
          });
          values.push(orderPricing(order, saved));
        }
        const pricing = checkoutPricing(values, cartKey);
        if (!controller.signal.aborted) setState({ key, pricing, loading: false, error: pricing.issues.length ? "Order pricing could not be confirmed. Please refresh the order pricing." : "" });
      } catch (failure) { if (!controller.signal.aborted) setState({ key, pricing: null, loading: false, error: failure instanceof Error ? failure.message : "The order total could not be loaded." }); }
    }
    void load();
    return () => controller.abort();
  }, [idsKey, key, revision, cartKey, createdKey]);
  const current = state.key === key ? state : { key, pricing: null, loading: orderIds.length > 0, error: "" };
  return { ...current, ready: !current.loading && !current.error && current.pricing?.buyerTotal != null, reload: () => setRevision(value => value + 1) };
}
