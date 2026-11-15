import { getAuth } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";

export const NOTIFICATIONS_UPDATED = "alpha-notifications-updated";
export type Notification = { id: string; title: string; body: string; type: string; isRead: boolean; count: number; date: string; data: Record<string, unknown> };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : "";

export async function notificationRequest(path = "", method = "GET", signal?: AbortSignal): Promise<unknown> {
  const stamp = accountStamp();
  const token = getAuth()!.access_token.replace(/^Bearer\s+/i, "").trim();
  const response = await fetch(`/api/user/notifications${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store", redirect: "error", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });
  checkAccount(stamp);
  let payload: unknown;
  if (response.status !== 204) {
    try { payload = await response.json(); } catch { throw new Error("Notifications returned an unreadable response. Please refresh."); }
  }
  checkAccount(stamp);
  const value = record(payload);
  if (!response.ok || value.success === false) throw new Error(text(value.error) || text(value.message) || (response.status === 401 ? "Your session has expired. Sign in again." : "Could not update or load notifications. Please refresh."));
  return payload;
}

export function notificationPage(payload: unknown, limit: number, offset: number) {
  const root = record(payload), data = root.data ?? payload;
  if (root.success === false) throw new Error(text(root.message) || "Could not load notifications.");
  const rows = Array.isArray(data) ? data : record(data).notifications ?? record(data).items;
  if (!Array.isArray(rows)) throw new Error("The notification list could not be read. Please refresh.");
  const items = rows.map(value => {
    const row = record(value);
    if (!text(row.id).trim() || typeof row.is_read !== "boolean") throw new Error("A notification could not be read. Please refresh.");
    return { id: text(row.id), title: text(row.title) || "Notification", body: text(row.body), type: text(row.type), isRead: row.is_read,
      count: Number.isSafeInteger(row.count) && Number(row.count) > 0 ? Number(row.count) : 1,
      date: text(row.last_event_at) || text(row.created_at), data: record(row.data) } satisfies Notification;
  });
  const total = record(root.meta).total ?? record(data).total;
  return { items, hasMore: typeof total === "number" && Number.isSafeInteger(total) && total >= 0 ? offset + rows.length < total : rows.length >= limit };
}

export function unreadCount(payload: unknown) {
  const root = record(payload), value = record(root.data ?? payload).unread_count;
  if (root.success === false || !Number.isSafeInteger(value) || Number(value) < 0) throw new Error("Unread notification count is unavailable.");
  return Number(value);
}

export function notificationLink(item: Notification, seller: boolean): string | null {
  const prefix = seller ? "/vendor" : "/dashboard";
  const id = (key: string) => text(item.data[key]).trim();
  if (item.type.startsWith("chat_")) return `${prefix}/messages`;
  if (id("order_id")) return `${prefix}/orders/${encodeURIComponent(id("order_id"))}`;
  if (id("ad_id")) return `${prefix}/my-ads/${encodeURIComponent(id("ad_id"))}`;
  if (id("product_id")) return seller ? `/vendor/products/${encodeURIComponent(id("product_id"))}` : `/products/${encodeURIComponent(id("product_id"))}`;
  return null;
}

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED));
}
