import type { Notification } from "./notificationClient";

export function latestDeliveryNotice(items: Notification[], orderId: string): Notification | null {
  return items.filter(item => {
    const title = item.title.trim();
    return !item.type.startsWith("chat_") && item.data.order_id === orderId && Number.isFinite(Date.parse(item.date)) &&
      /\b(rider|delivery)\b/i.test(title) && /\b(pickup|pick up|assigned|accepted|collected|transit|way|delivered|completed|cancelled|failed)\b/i.test(title);
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0] ?? null;
}

export function noticeRiderName(notice: Notification | null): string {
  return riderNameFromData(notice?.data);
}

export function riderNameFromData(data?: Record<string, unknown>): string {
  if (!data) return "";
  const rider = data.rider && typeof data.rider === "object" && !Array.isArray(data.rider) ? data.rider as Record<string, unknown> : {};
  const user = rider.user && typeof rider.user === "object" && !Array.isArray(rider.user) ? rider.user as Record<string, unknown> : {};
  const values = [data.rider_first_name, data.rider_name, rider.first_name, rider.name, user.first_name, user.name];
  return values.find(value => typeof value === "string" && value.trim()) as string || "";
}
