import { readAccountData, writeAccountData } from "./localAccountData";
export type ReviewDraft = { rating: number; text: string };
function valid(value: unknown): value is ReviewDraft | null {
  if (value === null) return true;
  const draft = value as ReviewDraft;
  return !!draft && Number.isInteger(draft.rating) && draft.rating >= 0 && draft.rating <= 5 && typeof draft.text === "string" && draft.text.length <= 2000;
}
function feature(orderId: string) { if (!orderId.trim()) throw new Error("This order has no valid ID."); return `review:${encodeURIComponent(orderId)}`; }
export const readReviewDraft = (orderId: string) => readAccountData(feature(orderId), () => null as ReviewDraft | null, valid);
export function saveReviewDraft(orderId: string, draft: ReviewDraft) {
  if (!valid(draft) || !draft || draft.rating === 0 && !draft.text.trim()) throw new Error("Choose a rating or write a review of up to 2000 characters.");
  readReviewDraft(orderId);
  writeAccountData(feature(orderId), draft);
}
export function discardReviewDraft(orderId: string) { writeAccountData(feature(orderId), null); }
