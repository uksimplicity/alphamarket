export type EscrowQueue = "pending" | "timed-out";
export type EscrowAction = "release" | "reverse";
export type EscrowRecord = {
  id: string; orderId: string; status: string; category: string;
  customer: string; recipient: string; amount: number | null; currency: string;
  createdAt: string; expiresAt: string;
};
type Row = Record<string, unknown>;
function record(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}
function text(value: unknown): string { return typeof value === "string" || typeof value === "number" ? String(value).trim() : ""; }
export function escrowCollection(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const row = record(payload);
  for (const key of ["data", "escrows", "orders", "items", "rows", "results"]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
    if (row[key] && typeof row[key] === "object") {
      const rows = escrowCollection(row[key]);
      if (rows.length) return rows;
    }
  }
  return [];
}
export function parseEscrows(payload: unknown, queue: EscrowQueue): EscrowRecord[] {
  return escrowCollection(payload).map(value => {
    const row = record(value), escrow = record(row.escrow), order = record(row.order);
    const rawAmount = row.amount ?? row.escrow_amount ?? escrow.amount;
    const amount = typeof rawAmount === "number" || typeof rawAmount === "string" && rawAmount.trim()
      ? Number(rawAmount) : NaN;
    return {
      // An order ID is not an escrow ID. Do not substitute one for the other.
      id: text(row.escrow_id ?? row.escrowId ?? escrow.id ?? row.id),
      orderId: text(row.order_id ?? row.orderId ?? order.id),
      status: text(row.escrow_status ?? row.escrowStatus ?? escrow.status ?? row.status ?? row.state).toLowerCase() || queue.replace("-", "_"),
      category: text(row.source ?? row.category ?? row.type ?? row.user_category ?? row.userCategory ?? order.source) || "Not specified",
      customer: text(row.buyer_name ?? row.customer_name ?? row.customerName ?? record(row.customer ?? row.buyer).name ?? row.buyer_id ?? row.customer_id) || "Not reported",
      recipient: text(row.recipient_name ?? row.payee_name ?? row.seller_name ?? row.rider_name ?? record(row.recipient).name ?? row.recipient_id ?? row.seller_id ?? row.rider_id) || "Not reported",
      amount: Number.isFinite(amount) ? amount : null,
      currency: text(row.currency ?? escrow.currency) || "NGN",
      createdAt: text(row.created_at ?? row.createdAt ?? escrow.created_at),
      expiresAt: text(row.expires_at ?? row.expiresAt ?? row.timeout_at ?? row.timed_out_at),
    };
  });
}
export function isEscrowAdmin(role?: string) {
  return ["admin", "super_admin", "marketplace_admin", "rider_admin"].includes((role ?? "").trim().toLowerCase());
}
export function escrowActionBody(action: EscrowAction, notes: string): { notes?: string } {
  const trimmed = notes.trim();
  if (action === "reverse" && !trimmed) throw new Error("Explain why this escrow is being reversed.");
  return trimmed ? { notes: trimmed } : {};
}
export function canResolveEscrow(item: EscrowRecord): boolean {
  return Boolean(item.id) && !["released", "reversed", "refunded", "cancelled", "completed", "paid_out"].includes(item.status);
}
export function escrowStatusFromOrder(payload: unknown): string {
  const root = record(payload);
  const row = record(root.data ?? root.order ?? payload);
  const order = record(row.order ?? row);
  return text(order.escrow_status ?? order.escrowStatus ?? record(order.escrow).status).toLowerCase() || "unknown";
}
export function escrowDescription(status: string): string {
  if (["released", "paid_out", "completed"].includes(status)) return "Escrow funds are marked as released.";
  if (["reversed", "refunded"].includes(status)) return "This escrow is marked as reversed or refunded.";
  if (["held", "funded", "locked", "in_escrow"].includes(status)) return "Funds are reported as held. Payment confirmation does not mean funds have been released.";
  if (status === "pending") return "This escrow is pending resolution. Payment confirmation and funds release are separate steps.";
  if (["timed_out", "timed-out", "expired"].includes(status)) return "This escrow requires review. A timeout does not automatically confirm a release or refund.";
  if (status === "unknown") return "Escrow status is not yet available for this order. Payment and escrow release are separate.";
  return "This is the reported escrow status. Payment and release are separate steps.";
}

export function canConfirmReceipt(order: { buyerId: string; status: string; paymentStatus: string; escrowStatus: string }, userId?: string) {
  return Boolean(userId && order.buyerId === userId) && order.status === "delivered" && order.paymentStatus === "paid"
    && !["released", "reversed", "refunded", "cancelled", "paid_out", "completed"].includes(order.escrowStatus);
}
