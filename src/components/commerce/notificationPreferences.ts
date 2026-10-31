import { readAccountData, writeAccountData } from "./localAccountData";
export const notificationOptions = {
  general: "General notifications", sound: "Sound", vibrate: "Vibrate", specialOffers: "Special offers",
  promotions: "Promo & discounts", payments: "Payments", cashback: "Cashback", appUpdates: "App updates",
  newServices: "New service available", tips: "New tips available",
} as const;
export type NotificationChoices = Record<keyof typeof notificationOptions, boolean>;
const empty = () => Object.fromEntries(Object.keys(notificationOptions).map(key => [key, false])) as NotificationChoices;
function valid(value: unknown): value is NotificationChoices { return !!value && typeof value === "object" && Object.keys(notificationOptions).every(key => typeof (value as Record<string, unknown>)[key] === "boolean"); }
export const readNotificationChoices = () => readAccountData("notifications", empty, valid);
export function saveNotificationChoice(key: keyof NotificationChoices, value: boolean) {
  const next = { ...readNotificationChoices(), [key]: value };
  writeAccountData("notifications", next);
  return next;
}
export function resetNotificationChoices() { const next = empty(); writeAccountData("notifications", next); return next; }
