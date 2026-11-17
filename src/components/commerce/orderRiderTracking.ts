import { assignedRider, orderDelivery, type AssignedRider } from "../vendor/orderDelivery";

export type DeliveryTracking = ReturnType<typeof orderDelivery>;

function deliveryRecord(payload: unknown, deliveryId: string, orderId: string) {
  let value = payload;
  for (let depth = 0; depth < 8; depth++) {
    const row = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
    if (row.success === false) throw new Error(typeof row.error === "string" ? row.error : "Delivery tracking could not be loaded.");
    const nested = row.data ?? row.delivery ?? row.Delivery;
    if (nested != null) { value = nested; continue; }
    const id = row.id ?? row.ID ?? row.delivery_id ?? row.deliveryId ?? row.DeliveryID;
    if (id !== deliveryId) throw new Error("The returned delivery does not match this order.");
    const linkedOrder = row.order_id ?? row.orderId ?? row.OrderID;
    if (linkedOrder && linkedOrder !== orderId) throw new Error("The returned delivery belongs to a different order.");
    return row;
  }
  throw new Error("Delivery tracking could not be read.");
}

export async function loadOrderRiderTracking(
  request: (path: string) => Promise<unknown>, initial: DeliveryTracking, orderId: string,
) {
  let tracking = initial;
  let rider: AssignedRider | null = null;
  let riderError = "";
  if (tracking.required === false) return { tracking, rider, riderError };
  try {
    if (!tracking.riderId && tracking.id) {
      const delivery = deliveryRecord(await request(`/api/marketplace/deliveries/${encodeURIComponent(tracking.id)}`), tracking.id, orderId);
      const resolved = orderDelivery({ delivery });
      tracking = { ...tracking, riderId: resolved.riderId, status: resolved.status || tracking.status,
        accepted: resolved.accepted || tracking.accepted, acceptedAt: resolved.acceptedAt || tracking.acceptedAt,
        updatedAt: resolved.updatedAt || tracking.updatedAt };
    }
    if (tracking.riderId) rider = assignedRider(await request(`/api/marketplace/grpc/riders/${encodeURIComponent(tracking.riderId)}`), tracking.riderId);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    riderError = error instanceof Error ? error.message : "Delivery and rider details could not be loaded.";
  }
  return { tracking, rider, riderError };
}
