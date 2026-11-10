function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function responseData(payload: unknown): unknown {
  const root = record(payload);
  return root && "data" in root ? root.data : payload;
}

export function paymentError(payload: unknown, fallback: string): string {
  const root = record(payload);
  const message = root?.error || root?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function createdOrderRows(payload: unknown): unknown[] {
  const data = responseData(payload);
  const root = record(data);
  const rows = Array.isArray(data) ? data : root?.orders ?? root?.order_ids ?? root?.orderIds ?? root?.order ?? data;
  return Array.isArray(rows) ? rows : [rows];
}

export function createdOrderIds(payload: unknown): string[] {
  const ids = createdOrderRows(payload).map((row) => {
    if (typeof row === "string") return row.trim();
    const item = record(row);
    const id = item?.id ?? item?.order_id ?? item?.orderId ?? item?.ID;
    return typeof id === "string" ? id.trim() : "";
  });
  if (ids.length === 0 || ids.some((id) => !id)) {
    throw new Error("The order was submitted, but the backend did not return order IDs. Check your orders before trying again.");
  }
  return [...new Set(ids)];
}

export function checkoutUrl(payload: unknown): string {
  const data = record(responseData(payload));
  const value = data?.checkout_url;
  if (typeof value !== "string") throw new Error("The payment service did not return a checkout link.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "checkout.paystack.com" || url.username || url.password || url.port) {
    throw new Error("The payment service returned an invalid Paystack checkout link.");
  }
  return url.href;
}

export function orderPaymentStatus(payload: unknown): string {
  const data = record(responseData(payload));
  const order = record(data?.order) ?? data;
  const status = order?.payment_status ?? order?.paymentStatus ?? order?.PaymentStatus;
  return typeof status === "string" ? status.toLowerCase() : "pending";
}

export function paymentReference(payload: unknown): string {
  const data = record(responseData(payload));
  return typeof data?.reference === "string" ? data.reference : "";
}

export const PENDING_CHECKOUT_KEY = "alpha.pending-checkout.v1";
export function checkoutStorageKey(buyerId: string, paid = false) {
  if (!buyerId.trim()) throw new Error("Please sign in with the buyer account.");
  return `${paid ? "alpha.last-paid-checkout.v1" : PENDING_CHECKOUT_KEY}:${encodeURIComponent(buyerId)}`;
}
export function readSavedCheckout(storage: Pick<Storage, "getItem" | "setItem" | "removeItem">, buyerId: string, paid = false) {
  const scoped = checkoutStorageKey(buyerId, paid), existing = storage.getItem(scoped);
  if (existing !== null) return existing;
  const legacy = paid ? "alpha.last-paid-checkout.v1" : PENDING_CHECKOUT_KEY;
  const raw = storage.getItem(legacy);
  if (raw && JSON.parse(raw)?.buyerId === buyerId) { storage.setItem(scoped, raw); storage.removeItem(legacy); return raw; }
  return null;
}
export type PendingCheckout = {
  buyerId: string;
  orderIds: string[];
  cartKey: string;
  checkoutUrl?: string;
  reference?: string;
  createdOrders?: unknown[];
  // Persisted before submitting so an uncertain response never triggers an automatic retry.
  submitted: boolean;
};
