import { getAuth } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { parseRider } from "./riderRecords";

export class RiderVerificationError extends Error {
  constructor(message: string, public uncertain: boolean) { super(message); }
}

export async function verifyRiderRequest(id: string): Promise<void> {
  const stamp = accountStamp();
  const token = getAuth()?.access_token?.replace(/^Bearer\s+/i, "").trim();
  let response: Response, payload: unknown;
  try {
    response = await fetch(`/api/admin/riders/${encodeURIComponent(id)}/verify`, {
      method: "POST", headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000),
    });
    checkAccount(stamp);
    payload = response.status === 204 ? { success: true } : await response.json();
  } catch {
    throw new RiderVerificationError("The verification result could not be confirmed. Refresh the queue before trying again.", true);
  }
  checkAccount(stamp);
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, unknown> : null;
  if (!response.ok || !root || root.success === false) {
    const reason = typeof root?.error === "string" ? root.error : typeof root?.message === "string" ? root.message : "Rider verification was not confirmed.";
    throw new RiderVerificationError(reason, response.status >= 500 || !root);
  }
}

export async function fetchRiderDetails(id: string, signal: AbortSignal): Promise<unknown> {
  const stamp = accountStamp();
  const token = getAuth()?.access_token?.replace(/^Bearer\s+/i, "").trim();
  const response = await fetch(`/api/marketplace/grpc/riders/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
  });
  checkAccount(stamp);
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new Error(`Rider details returned an unreadable response (HTTP ${response.status}).`); }
  checkAccount(stamp);
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (!response.ok || root.success === false) {
    const reason = typeof root.error === "string" ? root.error : typeof root.message === "string" ? root.message : "Rider details are unavailable.";
    if (response.status === 403) throw new Error("The rider details service denied this request (HTTP 403), although the verification queue is accessible. The backend access rules for this endpoint need investigation. The submitted queue information is still shown.");
    throw new Error(`${reason} (HTTP ${response.status}). The submitted queue information is still shown.`);
  }
  const detail = parseRider(payload);
  if (!detail.id) throw new Error("The rider service did not return an identifiable profile. The submitted queue information is still shown.");
  if (detail.id !== id) throw new Error("The returned profile does not match this rider. Only the information submitted to the queue is shown.");
  return payload;
}
