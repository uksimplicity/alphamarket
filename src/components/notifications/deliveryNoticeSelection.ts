import type { Notification } from "./notificationClient";

export function latestDeliveryNotice(items: Notification[], orderId: string): Notification | null {
  return items.filter(item => {
    const title = item.title.trim();
    return !item.type.startsWith("chat_") && item.data.order_id === orderId && Number.isFinite(Date.parse(item.date)) &&
      /\b(rider|delivery)\b/i.test(title) && /\b(pickup|pick up|assigned|accepted|collected|transit|way|delivered|completed|cancelled|failed)\b/i.test(title);
  }).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0] ?? null;
}
