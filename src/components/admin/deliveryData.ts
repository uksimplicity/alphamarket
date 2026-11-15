type Row = Record<string, unknown>;
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const first = (row: Row, keys: string[]) => keys.map(key => text(row[key])).find(Boolean) || "";
export type AdminDelivery = { id: string; orderId: string; orderNumber: string; riderId: string; status: string };
export type DeliveryFilters = { status: string; riderId: string; orderId: string };
export const deliveryStatuses = ["requested", "assigned", "picking_up", "on_the_way", "delivered", "completed", "cancelled"] as const;

function deliveryRows(payload: unknown, depth = 0): unknown[] {
  if (depth > 8) throw new Error("The delivery list could not be read. Please refresh.");
  if (Array.isArray(payload)) return payload;
  const row = record(payload);
  if (row.success === false) throw new Error(text(row.error) || text(row.message) || "Deliveries could not be loaded.");
  for (const key of ["data", "deliveries", "items", "results", "rows"]) if (row[key] != null) return deliveryRows(row[key], depth + 1);
  throw new Error("The delivery list could not be read. Please refresh.");
}

export async function loadAdminDeliveries(request: (path: string) => Promise<unknown>, filters: Pick<DeliveryFilters, "status" | "riderId">): Promise<AdminDelivery[]> {
  if (filters.status && !deliveryStatuses.some(status => status === filters.status)) throw new Error("Choose a delivery status from the list.");
  const result: AdminDelivery[] = [], seen = new Set<string>();
  for (let offset = 0; offset < 10000;) {
    const query = new URLSearchParams({ limit: "100", offset: String(offset) });
    if (filters.status) query.set("status", filters.status);
    if (filters.riderId.trim()) query.set("rider_id", filters.riderId.trim());
    const payload = await request(`/deliveries?${query}`);
    const rows = deliveryRows(payload);
    const root = record(payload), data = record(root.data), meta = record(root.meta);
    const total = data.total ?? meta.total ?? root.total;
    const knownTotal = typeof total === "number" && Number.isSafeInteger(total) && total >= 0 ? total : null;
    let added = 0;
    for (const value of rows) {
      const row = record(value), id = first(row, ["id", "delivery_id", "deliveryId", "ID", "DeliveryID"]);
      if (!id) throw new Error("A delivery has no readable ID. Please refresh.");
      if (!seen.has(id)) {
        seen.add(id); added++;
        result.push({
          id, orderId: first(row, ["order_id", "orderId", "orderID", "OrderID"]),
          orderNumber: first(row, ["order_number", "orderNumber", "OrderNumber"]),
          riderId: first(row, ["rider_id", "riderId", "riderID", "RiderID"]),
          status: first(row, ["status", "Status"]) || "Not reported",
        });
      }
    }
    if (!rows.length) {
      if (knownTotal !== null && offset < knownTotal) throw new Error("The service returned an incomplete delivery list. Please refresh.");
      return result;
    }
    if (!added) throw new Error("The delivery service returned a repeated page. Please refresh.");
    offset += rows.length;
    if (knownTotal !== null && offset >= knownTotal) return result;
  }
  throw new Error("The delivery list is too large to search completely. Narrow the status or rider filter.");
}

export function searchDeliveries(rows: AdminDelivery[], orderId: string) {
  const query = orderId.trim().toLowerCase();
  return query ? rows.filter(row => [row.orderId, row.orderNumber].some(value => value.toLowerCase().includes(query))) : rows;
}
