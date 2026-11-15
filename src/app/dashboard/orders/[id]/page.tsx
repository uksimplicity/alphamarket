"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { canConfirmReceipt } from "@/components/commerce/escrow";
import EscrowStatus from "@/components/commerce/EscrowStatus";
import ReviewDraftButton from "@/components/commerce/ReviewDraftButton";
import OrderMoneyBreakdown from "@/components/commerce/OrderMoneyBreakdown";
import { paymentError } from "@/components/commerce/payments";
import { useBuyerOrders } from "@/components/commerce/buyerOrders";
import BuyerDeliveryTracking from "@/components/commerce/BuyerDeliveryTracking";
import BuyerOrderSeller from "@/components/commerce/BuyerOrderSeller";
import {
  formatCurrency,
} from "@/components/commerce/store";
import { Button, ErrorState } from "@/components/dashboard/ui";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import styles from "@/components/commerce/orderDetails.module.css";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { orders, loading, error, reload, checkedAt, refreshing } = useBuyerOrders(params.id);
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
    <div className={styles.page}>
      <Link href="/dashboard/orders" className={styles.back}><ShopperIcon name="arrow" size={15} />Back to my orders</Link>
      {feedback ? <p role="status" className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700">{feedback}</p> : null}
      <header className={styles.hero}>
        <div className={styles.heroTop}>
          <div><p className={styles.eyebrow}>A little closer to your doorstep</p><h1 className={styles.title}>Order #{order.id.slice(-8).toUpperCase()}</h1><p className={styles.seller}><BuyerOrderSeller order={order} /></p></div>
          <div className={styles.total}><span>Order total</span><strong>{order.total === null ? "Total unavailable" : formatCurrency(order.total)}</strong></div>
        </div>
        {["delivered", "confirmed"].includes(order.status) ? <div className="mt-4"><ReviewDraftButton orderId={order.id} /></div> : null}
        <div className={styles.heroBottom}>
          <div className={styles.badges}><span className={styles.badge}>Order: {order.status.replaceAll("_", " ")}</span><span className={`${styles.badge} ${order.paymentStatus === "paid" ? styles.paid : ""}`}><ShopperIcon name="shield" size={13} />Payment: {order.paymentStatus.replaceAll("_", " ")}</span></div>
          <span className={styles.placed}>{Number.isFinite(Date.parse(order.createdAt)) ? <>Placed <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</time></> : "Order date unavailable"}</span>
        </div>
        <p className={styles.reference}>Order ID: {order.id}</p>
      </header>

      <div className={styles.columns}>
      <div className={styles.main}>
      <BuyerDeliveryTracking order={order} checkedAt={checkedAt} refreshing={refreshing} reload={reload} />

      <section className={styles.panel} aria-label="Products">
        <div className={styles.panelHeading}><div className={styles.headingLabel}><span className={styles.icon}><ShopperIcon name="orders" size={18} /></span><h2>In your order</h2></div><span className={styles.caption}>{order.items.length} {order.items.length === 1 ? "item" : "items"} listed</span></div>
        <div>
          {order.items.map((product) => (
            <div key={product.id} className={styles.product}>
              <span className={styles.icon}><ShopperIcon name="orders" size={17} /></span>
              <span className={styles.productName}>{product.name}<small>Quantity: {product.qty}</small></span>
              <strong>{product.price === null ? "" : formatCurrency(product.price * product.qty)}</strong>
            </div>
          ))}
          {!order.items.length ? <p className={styles.caption}>Product details will appear when available.</p> : null}
        </div>
      </section>

      <section className={styles.panel} aria-label="Delivery address">
        <div className={styles.panelHeading}><div className={styles.headingLabel}><span className={styles.icon}><ShopperIcon name="pin" size={18} /></span><h2>Delivery address</h2></div></div>
        <address className={styles.address}>{order.address || "Delivery address unavailable"}</address>
      </section>
      </div>
      <aside className={styles.aside} aria-label="Payment and order summary">
        <section className={`${styles.panel} ${styles.pricing}`}>
          <div className={styles.panelHeading}><h2>Order summary</h2><span className={styles.caption}>NGN</span></div>
          <OrderMoneyBreakdown pricing={order.pricing} />
          <p className={styles.security}><ShopperIcon name="shield" size={16} />Payment and delivery updates are shown as confirmed by Alpha Marketplace.</p>
        </section>
        <section className={styles.panel} aria-label="Payment protection">
          <div className={styles.panelHeading}><div className={styles.headingLabel}><span className={styles.icon}><ShopperIcon name="shield" size={18} /></span><h2>Payment & receipt</h2></div></div>
          <EscrowStatus status={order.escrowStatus} />
          {canConfirmReceipt(order, user?.id) ? <div className="mt-4"><p className="mb-3 text-sm text-slate-600">Confirm only after you have received your order. Confirming receipt can release the funds held for this order.</p><Button disabled={submitting || receiptSent || uncertain} onClick={() => confirmation.current?.showModal()}>{receiptSent ? "Receipt confirmed" : "Confirm receipt"}</Button></div> : null}
          <div className="mt-4"><button type="button" className={styles.refresh} disabled={submitting || refreshing} onClick={reload}><ShopperIcon name="refresh" size={13} />Refresh order status</button></div>
        </section>
      </aside>
      </div>

      <dialog ref={confirmation} aria-labelledby="receipt-title" onCancel={event => { if (submitting) event.preventDefault(); }} className="w-[calc(100%_-_32px)] max-w-md rounded-xl border border-slate-200 p-6 backdrop:bg-slate-900/40">
        <h2 id="receipt-title" className="text-lg font-semibold text-slate-900">Have you received your order?</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">Confirming receipt may release the funds held for this order. Continue only when you have received it and are ready to confirm delivery.</p><div className="mt-5 flex justify-end gap-2"><Button autoFocus variant="ghost" disabled={submitting} onClick={() => confirmation.current?.close()}>Cancel</Button><Button disabled={submitting} onClick={() => void confirmReceipt()}>{submitting ? "Confirming..." : "Yes, confirm receipt"}</Button></div>
      </dialog>
    </div>
  );
}
