import { asRow, customerName, parseSellerOrders, type SellerOrder } from "./sellerData";

// Both backend order serializers are also supported by the mobile application.
export function normalizeOrder(value: unknown): Record<string, unknown> {
  const row = { ...asRow(value) };
  for (const [key, alias] of Object.entries({
    id: "ID", order_number: "OrderNumber", buyer_id: "BuyerID", seller_id: "SellerID",
    status: "Status", payment_status: "PaymentStatus",
    dropoff_address: "DeliveryAddress", delivery_id: "DeliveryID", requires_delivery: "RequiresDelivery",
    escrow_id: "EscrowID", created_at: "CreatedAt", updated_at: "UpdatedAt", items: "Items",
  })) if (row[key] == null && row[alias] != null) row[key] = row[alias];
  return row;
}

// The authenticated order detail is the source for customer names omitted by lists.
// Identity errors or unavailable details never replace a name with another buyer.
export async function loadOrderCustomerNames(request: (path: string) => Promise<unknown>, orders: SellerOrder[]): Promise<SellerOrder[]> {
  const result = orders.map(order => ({ ...order }));
  const missing = result.filter(order => !order.customer || order.customer === "Customer");
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, missing.length) }, async () => {
    while (cursor < missing.length) {
      const order = missing[cursor++];
      try {
        const detail = sellerOrderDetail(await request(`/api/seller/orders/${encodeURIComponent(order.id)}`));
        if ((detail.id ?? detail.order_id) !== order.id) continue;
        const buyerId = String(detail.buyer_id ?? detail.buyerId ?? "");
        if (order.buyerId && buyerId && buyerId !== order.buyerId) continue;
        const name = customerName(detail);
        if (name) order.customer = name;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        // Preserve readable orders; missing names remain explicit.
      }
    }
  }));
  return result;
}

function checked(value: unknown) {
  const row = asRow(value);
  if (row.success === false || row.fallback === true) {
    throw new Error(typeof row.error === "string" ? row.error : typeof row.message === "string" ? row.message : "Orders could not be loaded. Please refresh.");
  }
  return row;
}

export function sellerOrderRows(payload: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 8) throw new Error("The order list could not be read. Please refresh.");
  if (Array.isArray(payload)) {
    const rows = payload.map(normalizeOrder);
    if (rows.some(row => typeof (row.id ?? row.order_id ?? row.uuid) !== "string" || !String(row.id ?? row.order_id ?? row.uuid).trim())) {
      throw new Error("An order could not be read. Please refresh.");
    }
    return rows;
  }
  const row = checked(payload);
  for (const key of ["data", "orders", "items", "rows", "results"]) {
    if (row[key] !== undefined && row[key] !== null) return sellerOrderRows(row[key], depth + 1);
  }
  throw new Error("The order list could not be read. Please refresh.");
}

export function sellerOrderDetail(payload: unknown): Record<string, unknown> {
  let value = payload;
  for (let depth = 0; depth < 8; depth++) {
    const row = checked(value);
    const nested = row.data ?? row.order ?? row.item;
    if (nested !== undefined) { value = nested; continue; }
    const order = normalizeOrder(row);
    if (typeof (order.id ?? order.order_id) === "string" && String(order.id ?? order.order_id).trim()) return order;
    break;
  }
  throw new Error("The order details could not be read. Please refresh.");
}

export async function loadSellerOrders(request: (path: string) => Promise<unknown>, sellerId: string): Promise<SellerOrder[]> {
  const rows: Record<string, unknown>[] = [], ids = new Set<string>();
  for (let offset = 0; offset <= 1e7; offset += 200) {
    const batch = sellerOrderRows(await request(`/api/seller/orders?limit=200&offset=${offset}`));
    let added = 0;
    for (const row of batch) {
      const id = String(row.id ?? row.order_id ?? row.uuid);
      if (!ids.has(id)) { rows.push(row); ids.add(id); added++; }
    }
    if (batch.length < 200) return parseSellerOrders(rows, sellerId);
    if (!added) throw new Error("The service returned a repeated order page. Please refresh.");
  }
  throw new Error("The orders could not be loaded completely.");
}
