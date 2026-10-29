type RecordValue = Record<string, unknown>;
export const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
export function payoutData(payload: unknown): unknown {
  let value = payload;
  for (let depth = 0; depth < 4 && "data" in record(value); depth++) value = record(value).data;
  return value;
}
function text(...values: unknown[]) { return values.find(value => typeof value === "string" && value.trim()) as string | undefined ?? ""; }
function amount(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value !== "number" && !(typeof value === "string" && value.trim())) continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) return numeric;
  }
  return null;
}
export type PayoutAccount = { number: string; name: string; bank: string; bankCode: string };
export function payoutAccount(payload: unknown): PayoutAccount | null {
  let value = record(payoutData(payload));
  value = record(value.payout_account ?? value.bank_account ?? value.account ?? value);
  const number = text(value.account_number, value.accountNumber);
  const name = text(value.account_name, value.accountName, value.account_holder_name);
  const bank = text(value.bank_name, value.bankName, record(value.bank).name);
  const bankCode = text(value.bank_code, value.bankCode, record(value.bank).code);
  return number ? { number, name, bank, bankCode } : null;
}
export function payoutSummary(payload: unknown) {
  const value = record(payoutData(payload));
  // Only explicit withdrawable fields qualify. Paid sales/wallet totals are not substitutes.
  return {
    available: amount(value.available_balance, value.available_to_withdraw, value.withdrawable_balance),
    pending: amount(value.pending_withdrawals_amount, value.pending_withdrawal_amount, value.pending_amount, typeof value.pending_withdrawals !== "object" ? value.pending_withdrawals : null),
  };
}
function list(payload: unknown, keys: string[]): unknown[] {
  const value = payoutData(payload);
  if (Array.isArray(value)) return value;
  const source = record(value);
  for (const key of keys) if (Array.isArray(source[key])) return source[key] as unknown[];
  throw new Error("The payout service returned an unrecognized list. Please refresh or contact support.");
}
export function payoutBanks(payload: unknown) {
  return list(payload, ["banks", "items"]).map(item => {
    const value = record(item);
    return { code: text(value.code, value.bank_code), name: text(value.name, value.bank_name) };
  }).filter(bank => bank.code && bank.name);
}
export type Withdrawal = { id: string; amount: number | null; status: string; created: string; reference: string; failure: string };
export function payoutWithdrawal(payload: unknown): Withdrawal {
  const outer = record(payoutData(payload));
  const value = record(outer.withdrawal ?? outer);
  return { id: text(value.id, value.withdrawal_id), amount: amount(value.amount), status: text(value.status).toLowerCase() || "unknown", created: text(value.created_at, value.createdAt), reference: text(value.reference, value.transfer_reference), failure: text(value.failure_reason, value.rejection_reason) };
}
export function payoutWithdrawals(payload: unknown): Withdrawal[] { return list(payload, ["withdrawals", "items", "rows"]).map(payoutWithdrawal); }
export function withdrawalAmount(input: string, available: number | null): number {
  if (!/^\d+(\.\d{1,2})?$/.test(input.trim())) throw new Error("Enter a naira amount with up to two decimal places.");
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(Math.round(value * 100))) throw new Error("Enter a positive withdrawal amount.");
  if (available === null) throw new Error("Refresh to load your available balance before withdrawing.");
  if (Math.round(value * 100) > Math.round(available * 100)) throw new Error("This amount exceeds your available balance.");
  return value;
}
export function payoutMoney(value: number | null) { return value === null ? "Not reported" : new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value); }
export function maskedAccount(number: string) { return number ? `•••• ${number.slice(-4)}` : "Not reported"; }
