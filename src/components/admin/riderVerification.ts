import { parseRider, type RiderRecord } from "./riderRecords";

export function unverifiedRiders(payload: unknown, depth = 0): RiderRecord[] {
  if (depth > 8) throw new Error("The rider queue could not be read. Please refresh.");
  if (Array.isArray(payload)) {
    const riders = payload.map(parseRider);
    if (riders.some(rider => !rider.id)) throw new Error("A rider in the queue has no rider ID. Please refresh.");
    return riders.filter(rider => rider.verificationStatus !== "verified");
  }
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  if (root.success === false) throw new Error(typeof root.error === "string" ? root.error : typeof root.message === "string" ? root.message : "The rider queue could not be loaded.");
  for (const key of ["data", "riders", "items", "results", "rows"]) {
    if (root[key] != null) return unverifiedRiders(root[key], depth + 1);
  }
  throw new Error("The rider queue could not be read. Please refresh.");
}

export async function verifyAndConfirm(
  id: string, verify: (id: string) => Promise<void>,
  refresh: () => Promise<{ isError: boolean; data?: RiderRecord[] }>,
  onAccepted: () => void,
) {
  await verify(id);
  onAccepted();
  let result: { isError: boolean; data?: RiderRecord[] };
  try { result = await refresh(); } catch { result = { isError: true }; }
  if (result.isError || !result.data) return {
    confirmed: false, message: "Verification was accepted, but the updated queue could not be loaded. Refresh the queue to confirm.",
  };
  if (result.data.some(rider => rider.id === id && rider.verificationStatus !== "verified")) return {
    confirmed: false, message: "Verification was accepted, but this rider is still in the unverified queue. Refresh the queue to confirm before trying again.",
  };
  return { confirmed: true, message: "Rider verified successfully." };
}
