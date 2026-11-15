import { asRow } from "./sellerData";

function read(sources: Record<string, unknown>[], keys: string[]) {
  for (const source of sources) for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function orderDelivery(order: Record<string, unknown>) {
  const delivery = asRow(order.delivery ?? order.Delivery);
  const rider = asRow(order.rider ?? order.Rider ?? delivery.rider ?? delivery.Rider);
  const required = order.requires_delivery ?? order.requiresDelivery ?? order.RequiresDelivery;
  return {
    required: typeof required === "boolean" ? required : null,
    id: read([order], ["delivery_id", "deliveryId", "DeliveryID"]) || read([delivery], ["id", "ID"]),
    status: read([order], ["delivery_status", "deliveryStatus", "DeliveryStatus"]) || read([delivery], ["status", "Status"]),
    riderId: read([order, delivery], ["rider_id", "riderId", "RiderID"]) || read([rider], ["id", "ID", "rider_id", "riderId"]),
    updatedAt: read([order], ["delivery_updated_at", "deliveryUpdatedAt", "DeliveryUpdatedAt"]) || read([delivery], ["updated_at", "updatedAt", "UpdatedAt"]),
  };
}

export type AssignedRider = { name: string; phone: string };

export function assignedRider(payload: unknown, expectedId: string): AssignedRider {
  let root = asRow(payload);
  for (let depth = 0; depth < 5; depth++) {
    if (root.success === false) throw new Error(read([root], ["error", "message"]) || "Rider details could not be loaded.");
    if (!root.data) break;
    root = asRow(root.data);
  }
  const rider = asRow(root.rider ?? root.Rider);
  const id = read([rider, root], ["rider_id", "riderId", "id", "ID"]);
  if (id && id !== expectedId) throw new Error("The returned rider does not match this order's assignment.");
  const profile = asRow(root.profile ?? rider.profile);
  const user = asRow(root.user ?? rider.user ?? profile.user);
  const contact = [user, asRow(user.profile), profile, rider, root];
  const name = read(contact, ["name", "full_name", "fullName", "Name"]) ||
    [read(contact, ["first_name", "firstName"]), read(contact, ["last_name", "lastName"])].filter(Boolean).join(" ");
  const phone = read(contact, ["phone", "phone_number", "phoneNumber", "Phone"]);
  if (!name && !phone) throw new Error("Rider contact details have not been reported.");
  return { name, phone };
}

export function deliveryStatusLabel(status: string) {
  const labels: Record<string, string> = {
    assigned: "Rider assigned", accepted: "Rider accepted", heading_to_pickup: "Heading to pickup",
    at_pickup: "At pickup", picked_up: "Collected", in_transit: "On the way to buyer",
    delivered: "Delivered", cancelled: "Cancelled", failed: "Delivery failed",
  };
  return labels[status.toLowerCase()] || status.replaceAll("_", " ") || "Not reported";
}
