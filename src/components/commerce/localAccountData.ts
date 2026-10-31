import { authGeneration, getAuth } from "@/components/auth/authStorage";

export function accountIdentity() {
  const auth = getAuth();
  if (!auth?.access_token?.trim()) throw new Error("Please sign in to save your changes.");
  const owner = auth.user?.id || (auth.user?.email ? `email:${auth.user.email.trim().toLowerCase()}` : "");
  if (!owner) throw new Error("Please sign in again to identify your account.");
  return owner;
}
export function accountStamp() {
  return `${accountIdentity()}\n${getAuth()?.access_token}\n${authGeneration()}`;
}
export function checkAccount(stamp: string) {
  if (accountStamp() !== stamp) throw new Error("Your account changed. Open this screen again.");
}
function key(feature: string) { return `alpha.local.v1:${feature}:${encodeURIComponent(accountIdentity())}`; }
export function readAccountData<T>(feature: string, empty: () => T, valid: (value: unknown) => value is T): T {
  let raw: string | null;
  try { raw = localStorage.getItem(key(feature)); }
  catch (error) { if (error instanceof Error && /sign in|account/.test(error.message)) throw error; throw new Error("Your browser could not read saved data. Please retry."); }
  if (raw === null) return empty();
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !valid(saved.data)) throw new Error();
    return saved.data;
  } catch { throw new Error("Saved data could not be loaded. Retry or reset this device's saved data to start again."); }
}
export function writeAccountData<T>(feature: string, value: T) {
  const target = key(feature);
  try { localStorage.setItem(target, JSON.stringify({ version: 1, data: value })); }
  catch { throw new Error("Your browser could not save the change. Your previous saved data is unchanged."); }
  window.dispatchEvent(new Event("alpha-local-data-updated"));
}
