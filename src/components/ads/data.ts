export type AdRecord = Record<string, unknown>;
export const record = (value: unknown): AdRecord => value && typeof value === "object" && !Array.isArray(value) ? value as AdRecord : {};
export const text = (value: unknown, fallback = "") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
export function unwrap(value: unknown): unknown {
  let current = value;
  for (let i = 0; i < 5; i++) {
    const row = record(current);
    if (!("data" in row)) return current;
    current = row.data;
  }
  return current;
}
export function rows(value: unknown): AdRecord[] {
  const data = unwrap(value);
  if (Array.isArray(data)) return data.map(record);
  const item = record(data);
  for (const key of ["ads", "products", "items", "rows", "plans", "promotion_plans", "promotions", "fees", "logs", "history", "categories", "locations", "product_types", "transactions"]) {
    if (Array.isArray(item[key])) return (item[key] as unknown[]).map(record);
  }
  throw new Error("The service returned an unreadable list. Please refresh.");
}
export function adRecord(value: unknown): AdRecord {
  const data = record(unwrap(value));
  return record(data.ad ?? data.product ?? data.plan ?? data);
}
export function numeric(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function amount(value: unknown, keys: string[]): number | null {
  const data = unwrap(value), direct = numeric(data);
  if (direct !== null) return direct;
  const item = record(data);
  for (const key of keys) {
    const number = numeric(item[key]);
    if (number !== null) return number;
    const nested = record(item[key]);
    const nestedNumber = numeric(nested.amount ?? nested.balance);
    if (nestedNumber !== null) return nestedNumber;
  }
  return null;
}
export const money = (value: unknown) => {
  const number = numeric(value);
  return number === null ? "Unavailable" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 }).format(number);
};
export const statusOf = (item: AdRecord) => text(item.moderation_status ?? item.moderationStatus ?? item.status).toLowerCase();
export const label = (value: unknown) => text(value).replace(/_/g, " ");
export const date = (value: unknown) => {
  const parsed = new Date(text(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString("en-NG", { timeZone: "Africa/Lagos" }) : "—";
};
export const statuses = ["pending", "approved", "rejected", "changes_requested", "suspended"];
export function hierarchyLabel(item: AdRecord, all: AdRecord[]): string {
  const names = [text(item.name)], seen = new Set([text(item.id)]);
  let parent = all.find(row => row.id === item.parent_id);
  while (parent && !seen.has(text(parent.id))) {
    names.unshift(text(parent.name)); seen.add(text(parent.id));
    parent = all.find(row => row.id === parent?.parent_id);
  }
  return names.join(" › ");
}
export function canPromote(item: AdRecord) {
  return statusOf(item) === "approved" && item.is_active !== false && item.is_published !== false && item.isPublished !== false && !item.deleted_at;
}
export function userUpdate(item: AdRecord) {
  return {
    name: text(item.name), shortDescription: text(item.description ?? item.shortDescription),
    basePrice: numeric(item.base_price ?? item.basePrice), categoryId: text(item.category_id ?? item.categoryId ?? record(item.category).id),
    locationId: text(item.location_id ?? item.locationId ?? record(item.location).id),
    address: text(item.address), stock: numeric(item.stock),
  };
}
