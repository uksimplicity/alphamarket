export type SellerProduct = {
  id: string; name: string; category: string; stock: number | null;
  price: number | null; status: string; image: string;
};
export type SellerOrder = {
  id: string; amount: number | null; status: string; paymentStatus: string;
  customer: string; createdAt: string;
};
type Row = Record<string, unknown>;
export function asRow(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}
function number(value: unknown): number | null {
  if (value === undefined || value === null || (typeof value === "string" && !value.trim())) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
export function collection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const row = asRow(payload);
  for (const key of ["data", "orders", "products", "items", "rows", "results"]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
    if (row[key] && typeof row[key] === "object") {
      const nested = collection(row[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}
function ownedBy(row: Row, sellerId: string): boolean {
  const owner = text(row.seller_id ?? row.sellerId ?? row.vendor_id ?? row.vendorId ?? row.owner_id ?? row.ownerId ?? asRow(row.seller).id);
  return !owner || owner === sellerId;
}
export function parseSellerProducts(payload: unknown, sellerId: string): SellerProduct[] {
  return collection(payload).map(asRow).filter(row => ownedBy(row, sellerId)).map(row => {
    const media = asRow(row.media);
    const cover = media.cover ?? row.cover_image ?? row.image;
    return {
      id: text(row.id ?? row.product_id ?? row.uuid), name: text(row.name ?? row.title) || "Untitled product",
      category: text(asRow(row.category).name ?? row.category_name ?? row.categoryName ?? row.category) || "Uncategorized",
      stock: number(row.stock ?? row.quantity), price: number(row.base_price ?? row.basePrice ?? row.price),
      status: text(row.status).toLowerCase() || "unknown",
      image: typeof cover === "string" ? cover : text(asRow(cover).url),
    };
  }).filter(row => row.id);
}
export function parseSellerOrders(payload: unknown, sellerId: string): SellerOrder[] {
  return collection(payload).map(asRow).filter(row => ownedBy(row, sellerId)).map(row => ({
    id: text(row.id ?? row.order_id ?? row.uuid),
    amount: number(row.total_amount ?? row.totalAmount ?? row.amount ?? row.total),
    status: text(row.status).toLowerCase() || "unknown",
    paymentStatus: text(row.payment_status ?? row.paymentStatus).toLowerCase() || "unknown",
    customer: text(row.customer_name ?? row.customerName ?? row.buyer_name ?? asRow(row.customer ?? row.buyer).name) || "Customer",
    createdAt: text(row.created_at ?? row.createdAt ?? row.ordered_at),
  })).filter(row => row.id);
}
export function isPaid(order: SellerOrder) { return order.paymentStatus === "paid"; }
export function needsFulfillment(order: SellerOrder) {
  return isPaid(order) && ["pending", "processing", "ready_for_pickup"].includes(order.status);
}
export function orderTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (["delivered", "confirmed", "completed", "paid", "publish", "published", "active"].includes(status)) return "success";
  if (["failed", "cancelled", "failed_delivery", "returned", "refunded", "reversed", "chargeback"].includes(status)) return "danger";
  if (["pending", "processing", "ready_for_pickup", "draft", "review", "pending_review"].includes(status)) return "warning";
  return "neutral";
}
export function scopedOrders(orders: SellerOrder[], days: number, now = new Date()): SellerOrder[] {
  const start = new Date(now); start.setDate(start.getDate() - days + 1); start.setHours(0, 0, 0, 0);
  return orders.filter(order => {
    const time = new Date(order.createdAt).getTime();
    return Number.isFinite(time) && time >= start.getTime() && time <= now.getTime();
  });
}
export function salesSeries(orders: SellerOrder[], days: number, now = new Date()) {
  const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const totals = new Map<string, number>();
  for (const order of scopedOrders(orders, days, now)) {
    if (!isPaid(order) || order.amount === null) continue;
    const key = dateKey(new Date(order.createdAt));
    totals.set(key, (totals.get(key) ?? 0) + order.amount);
  }
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now); date.setDate(date.getDate() - days + index + 1);
    return { date: date.toLocaleDateString("en-NG", { month: "short", day: "numeric" }), sales: totals.get(dateKey(date)) ?? 0 };
  });
}
export const money = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
export const humanize = (value: string) => value.replaceAll("_", " ");
