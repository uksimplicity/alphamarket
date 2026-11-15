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

type CheckoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
function checkoutIndexKey(buyerId: string, kind: "order" | "reference", value: string) {
  return `alpha.checkout-history.v1:${encodeURIComponent(buyerId)}:${kind}:${encodeURIComponent(value)}`;
}
function savedCheckout(raw: string | null, buyerId: string): PendingCheckout | null {
  if (raw === null) return null;
  const value = JSON.parse(raw) as PendingCheckout;
  if (!value || value.buyerId !== buyerId || value.submitted !== true || typeof value.cartKey !== "string" || !Array.isArray(value.orderIds) || value.orderIds.some(id => typeof id !== "string" || !id.trim())) {
    throw new Error("Saved checkout could not be read. Check your orders before starting another payment.");
  }
  return value;
}
export function selectCheckout(storage: CheckoutStorage, buyerId: string, cartKey: string, orderId = "", resume = false): PendingCheckout | null {
  const active = savedCheckout(readSavedCheckout(storage, buyerId), buyerId);
  if (active && !active.orderIds.length) throw new Error("The previous order submission could not be confirmed. Check your orders before placing another order.");
  if (orderId) {
    if (active?.orderIds.includes(orderId)) return active;
    return savedCheckout(storage.getItem(checkoutIndexKey(buyerId, "order", orderId)), buyerId)
      ?? { buyerId, orderIds: [orderId], cartKey: "", submitted: true };
  }
  if (resume) return active;
  // Cart checkout must never silently select a different saved basket/order.
  return active?.cartKey === cartKey ? active : null;
}
export function rememberCheckout(storage: CheckoutStorage, value: PendingCheckout) {
  const previous = savedCheckout(readSavedCheckout(storage, value.buyerId), value.buyerId);
  function index(checkout: PendingCheckout) {
    const raw = JSON.stringify(checkout);
    for (const id of checkout.orderIds) storage.setItem(checkoutIndexKey(checkout.buyerId, "order", id), raw);
    if (checkout.reference) storage.setItem(checkoutIndexKey(checkout.buyerId, "reference", checkout.reference), raw);
  }
  if (previous) {
    if (!previous.orderIds.length && previous.cartKey !== value.cartKey) throw new Error("Check the previous order submission before starting another checkout.");
    index(previous);
  }
  // Preserve old payment references before replacing the active checkout.
  index(value);
  storage.setItem(checkoutStorageKey(value.buyerId), JSON.stringify(value));
}
export function checkoutForReference(storage: CheckoutStorage, buyerId: string, reference: string): PendingCheckout | null {
  const candidates = [readSavedCheckout(storage, buyerId), readSavedCheckout(storage, buyerId, true)];
  for (const raw of candidates) {
    const checkout = savedCheckout(raw, buyerId);
    if (checkout && (!reference || checkout.reference === reference)) return checkout;
  }
  if (!reference) return null;
  const archived = savedCheckout(storage.getItem(checkoutIndexKey(buyerId, "reference", reference)), buyerId);
  return archived?.reference === reference ? archived : null;
}
