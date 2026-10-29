"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { canConfirmReceipt } from "@/components/commerce/escrow";
import EscrowStatus from "@/components/commerce/EscrowStatus";
import { paymentError } from "@/components/commerce/payments";
import { useBuyerOrders } from "@/components/commerce/buyerOrders";
import {
  formatCurrency,
} from "@/components/commerce/store";
import { Badge, Button, Card, ErrorState, SectionTitle } from "@/components/dashboard/ui";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { orders, loading, error, reload } = useBuyerOrders(params.id);
  const user = useAuthUser();
  const [submitting, setSubmitting] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [feedback, setFeedback] = useState("");
  const confirmation = useRef<HTMLDialogElement>(null);
  const lock = useRef(false);
  const order = orders[0];
  useEffect(() => { setReceiptSent(false); setUncertain(false); setFeedback(""); confirmation.current?.close(); }, [params.id, user?.id]);
  async function confirmReceipt() {
    if (!order || !canConfirmReceipt(order, user?.id) || lock.current || receiptSent || uncertain) return;
    const token = getAuth()?.access_token;
    if (!token) { setFeedback("Please sign in again to confirm receipt."); return; }
    lock.current = true; setSubmitting(true); setFeedback("");
    try {
      const response = await fetch(`/api/buyer/orders/${encodeURIComponent(order.id)}/confirm-delivery`, {
        method: "POST", headers: { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, "").trim()}`, Accept: "application/json" },
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;
      if (!response.ok || payload?.success === false) throw new Error(paymentError(payload, "Delivery confirmation was not accepted."));
      setReceiptSent(true);
      setFeedback("Receipt confirmation accepted. The latest order and escrow statuses appear below.");
      confirmation.current?.close();
      reload();
    } catch (err) {
      setUncertain(true);
      setFeedback((err instanceof Error ? err.message : "The confirmation result could not be verified.") + " Check the order status before taking another action.");
      confirmation.current?.close();
    } finally { lock.current = false; setSubmitting(false); }
  }
  if (loading) return <p>Loading order...</p>;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  if (!order) {
    return (
      <div className="grid gap-6">
        <ErrorState message="Order not found." />
        <Link
          href="/dashboard/orders"
          className="text-sm font-semibold text-brand"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {feedback ? <p role="status" className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">{feedback}</p> : null}
      <Card>
        <SectionTitle title={`Order ${order.id}`} subtitle={`Vendor: ${order.vendor}`} />
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <Badge>{order.status}</Badge>
          <span className="font-semibold text-slate-800">
            {order.total === null ? "Total unavailable" : `Total ${formatCurrency(order.total)}`}
          </span>
          <span className="text-xs text-slate-500">Placed {order.createdAt}</span>
          <Badge>Payment: {order.paymentStatus}</Badge>
        </div>
      </Card>

      <Card>
        <EscrowStatus status={order.escrowStatus} />
        {canConfirmReceipt(order, user?.id) ? <div className="mt-4"><p className="mb-3 text-sm text-slate-600">Confirm only after you have received your order. Confirming receipt can release the funds held for this order.</p><Button disabled={submitting || receiptSent || uncertain} onClick={() => confirmation.current?.showModal()}>{receiptSent ? "Receipt confirmed" : "Confirm receipt"}</Button></div> : null}
        <div className="mt-3"><Button variant="ghost" disabled={submitting} onClick={reload}>Refresh order status</Button></div>
      </Card>

      <Card>
        <SectionTitle title="Products" />
        <div className="mt-4 space-y-2 text-sm">
          {order.items.map((product) => (
            <div key={product.id} className="flex justify-between">
              <span>
                {product.name} x{product.qty}
              </span>
              <span>{product.price === null ? "" : formatCurrency(product.price * product.qty)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Delivery Address" />
        <p className="mt-3 text-sm text-slate-600">{order.address}</p>
      </Card>

      <Link href="/dashboard/orders" className="text-sm font-semibold text-brand">Back to orders</Link>
      <dialog ref={confirmation} aria-labelledby="receipt-title" onCancel={event => { if (submitting) event.preventDefault(); }} className="w-[calc(100%_-_32px)] max-w-md rounded-xl border border-slate-200 p-6 backdrop:bg-slate-900/40">
        <h2 id="receipt-title" className="text-lg font-semibold text-slate-900">Have you received your order?</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">Confirming receipt may release the funds held for this order. Continue only when you have received it and are ready to confirm delivery.</p><div className="mt-5 flex justify-end gap-2"><Button autoFocus variant="ghost" disabled={submitting} onClick={() => confirmation.current?.close()}>Cancel</Button><Button disabled={submitting} onClick={() => void confirmReceipt()}>{submitting ? "Confirming..." : "Yes, confirm receipt"}</Button></div>
      </dialog>
    </div>
  );
}
