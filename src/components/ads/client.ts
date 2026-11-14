"use client";
import { getAuth } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { amount, record, rows, type AdRecord } from "./data";

export class AdsError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function adsRequest(path: string, init: RequestInit = {}, authenticated = true): Promise<unknown> {
  const auth = authenticated ? getAuth() : null;
  if (authenticated && !auth?.access_token) throw new AdsError("Sign in to continue.", 401);
  const stamp = authenticated ? accountStamp() : "";
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (auth) headers.set("Authorization", /^Bearer\s/i.test(auth.access_token) ? auth.access_token : `Bearer ${auth.access_token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  let response: Response;
  try { response = await fetch(path, { ...init, headers, cache: "no-store" }); }
  catch { throw new AdsError("The request could not be confirmed. Refresh and check the record and wallet before retrying.", 0); }
  if (authenticated) checkAccount(stamp);
  if (response.status === 204) return null;
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new AdsError("The service returned an unreadable response. Refresh before retrying.", 502); }
  const root = record(payload);
  if (!response.ok || root.success === false) {
    const error = typeof root.error === "string" ? root.error : record(root.error).message ?? root.message;
    throw new AdsError(typeof error === "string" ? error : `Ads request failed (${response.status}).`, response.ok ? 422 : response.status);
  }
  return payload;
}
export type PostingCost = { fee: number; balance: number | null };
export async function loadDirectory(path: string, authenticated = false): Promise<AdRecord[]> {
  const values = new Map<string, AdRecord>();
  for (let offset = 0; offset < 10_000; offset += 100) {
    const result = rows(await adsRequest(`${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`, {}, authenticated));
    for (const item of result) if (typeof item.id === "string" && item.is_active !== false) values.set(item.id, item);
    if (result.length < 100) return [...values.values()];
  }
  throw new AdsError("The directory could not be fully loaded. Please refresh.", 502);
}
export async function fetchPostingCost(categoryId: string): Promise<PostingCost> {
  const [quote, wallet] = await Promise.allSettled([
    adsRequest(`/api/my-ads/posting-fee?category_id=${encodeURIComponent(categoryId)}`),
    adsRequest("/api/wallet/balance"),
  ]);
  if (quote.status === "rejected") throw quote.reason;
  const fee = amount(quote.value, ["amount", "fee", "posting_fee", "fee_amount"]);
  if (fee === null || fee < 0) throw new AdsError("The posting fee could not be read. Please refresh the quote.", 502);
  const balance = wallet.status === "fulfilled" ? amount(wallet.value, ["balance", "available_balance", "wallet_balance", "wallet"]) : null;
  return { fee, balance };
}
