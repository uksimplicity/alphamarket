import { productImage } from "../products/productMedia";
import { orderPricing, type OrderPricing } from "../commerce/orderPricing";

export type SellerProduct = {
  id: string; name: string; category: string; stock: number | null;
  price: number | null; status: string; image: string;
};
export type SellerOrder = {
  id: string; amount: number | null; status: string; paymentStatus: string;
  customer: string; createdAt: string;
  pricing: OrderPricing;
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
  for (const key of ["data", "orders", "products", "categories", "items", "rows", "results"]) {
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
// Load every inventory page so counts and stock alerts include the whole store.
async function loadPages(request: (path: string) => Promise<unknown>, path: string) {
  const rows: unknown[] = [];
  const ids = new Set<string>();
  for (let offset = 0; offset <= 1e7; offset += 200) {
    const batch = collection(await request(`${path}${path.includes("?") ? "&" : "?"}limit=200&offset=${offset}`));
    let added = 0;
    for (const value of batch) {
      const row = asRow(value);
      const id = text(row.id ?? row.product_id ?? row.productId ?? row.category_id ?? row.uuid);
      if (!id || !ids.has(id)) { rows.push(value); added++; if (id) ids.add(id); }
    }
    if (batch.length < 200) return rows;
    if (!added) throw new Error("The service returned a repeated inventory page.");
  }
  throw new Error("The inventory could not be loaded completely.");
}
export async function loadSellerCategories(request: (path: string) => Promise<unknown>): Promise<Record<string, string>> {
  const categoryRows = await loadPages(request, "/api/seller/catalog?resource=categories");
  const categories: Record<string, string> = {};
  for (const value of categoryRows) {
    const row = asRow(value), id = text(row.id ?? row.category_id ?? row.categoryId ?? row.uuid);
    const name = text(row.name ?? row.title ?? row.category_name ?? row.categoryName);
    if (id && name) categories[id] = name;
  }
  return categories;
}
export async function loadSellerProducts(request: (path: string) => Promise<unknown>, sellerId: string): Promise<SellerProduct[]> {
  const [products, categories] = await Promise.all([
    loadPages(request, "/api/seller/products"),
    loadSellerCategories(request).catch(() => ({})),
  ]);
  return parseSellerProducts(products, sellerId, categories);
}
export function parseSellerProducts(payload: unknown, sellerId: string, categories: Record<string, string> = {}): SellerProduct[] {
  return collection(payload).map(asRow).filter(row => ownedBy(row, sellerId)).map(row => {
    const category = asRow(row.category);
    const categoryId = text(row.category_id ?? row.categoryId ?? category.id);
    const published = row.isPublished ?? row.is_published;
    const active = row.is_active ?? row.isActive ?? row.active;
    const status = text(row.status).toLowerCase();
    return {
      id: text(row.id ?? row.product_id ?? row.productId ?? row.uuid), name: text(row.name ?? row.title) || "Untitled product",
      category: text(category.name) || text(row.category_name) || text(row.categoryName) || categories[categoryId] || categories[text(row.category)] || text(row.category) || (categoryId ? "Category unavailable" : "Uncategorized"),
      stock: number(row.stock ?? row.quantity ?? row.stock_quantity ?? row.stockQuantity ?? asRow(row.inventory).stock ?? asRow(row.inventory).quantity), price: number(row.base_price ?? row.basePrice ?? row.price),
      status: status || (published === true ? "publish" : published === false ? "draft" : active === true ? "active" : active === false ? "inactive" : "unknown"),
      image: productImage(row, ""),
    };
  }).filter(row => row.id);
}
export function parseSellerOrders(payload: unknown, sellerId: string): SellerOrder[] {
  return collection(payload).map(asRow).filter(row => ownedBy(row, sellerId)).map(row => ({
    id: text(row.id ?? row.order_id ?? row.uuid),
    amount: number(row.total_amount ?? row.totalAmount ?? row.amount ?? row.total),
    pricing: orderPricing(row),
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
