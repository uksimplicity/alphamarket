"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { orderDeliveryLabel, orderDelivery, type AssignedRider } from "@/components/vendor/orderDelivery";
import { loadOrderRiderTracking, type DeliveryTracking } from "@/components/commerce/orderRiderTracking";
import { escrowStatusFromOrder } from "@/components/commerce/escrow";
import { orderPaymentStatus } from "@/components/commerce/payments";
import EscrowStatus from "@/components/commerce/EscrowStatus";
import OrderMoneyBreakdown from "@/components/commerce/OrderMoneyBreakdown";
import { orderPricing, pricingMoney } from "@/components/commerce/orderPricing";
import { sellerOrderDetail } from "@/components/vendor/sellerOrders";
import { customerName } from "@/components/vendor/sellerData";
import { ChatClient } from "@/components/chat/chatClient";
import Icon from "@/components/admin/AdminIcon";
import styles from "@/components/vendor/vendor.module.css";
import detail from "@/components/vendor/sellerOrderDetail.module.css";

export default function VendorOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const user = useAuthUser();
  const key = `${user?.id || ""}:${orderId || ""}`;
  const [snapshot, setSnapshot] = useState<{
    key: string; order: Record<string, unknown> | null; rider: AssignedRider | null;
    riderError: string; error: string; checkedAt: string; tracking: DeliveryTracking | null;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [revision, setRevision] = useState(0);
  const [openingChat, setOpeningChat] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatRequest = useRef<AbortController | null>(null);
  const current = snapshot?.key === key ? snapshot : null;
  const order = current?.order ?? null;
  const error = current?.error || "";
  const loading = !current;

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    async function loadOrder() {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      setRefreshing(true);
      try {
        if (!orderId || !user?.id) throw new Error("Sign in with your seller account to view this order.");
        const stamp = accountStamp();
        const token = getAuth()?.access_token || "";
        const headers = { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, "").trim()}`, Accept: "application/json" };
        async function request(path: string) {
          checkAccount(stamp);
          const response = await fetch(path, { headers, cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
          const payload: unknown = await response.json();
          checkAccount(stamp);
          const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
          if (!response.ok || root.success === false) throw new Error(
            typeof root.error === "string" ? root.error : typeof root.message === "string" ? root.message : `Details could not be loaded (${response.status}).`
          );
          return payload;
        }
        const next = sellerOrderDetail(await request(`/api/seller/orders/${encodeURIComponent(orderId)}`));
        if (controller.signal.aborted) return;
        const { tracking, rider, riderError } = await loadOrderRiderTracking(request, orderDelivery(next), orderId);
        if (controller.signal.aborted) return;
        checkAccount(stamp);
        setSnapshot({ key, order: next, tracking, rider, riderError, error: "", checkedAt: new Date().toISOString() });
      } catch (failure) {
        if (controller.signal.aborted) return;
        setSnapshot({ key, order: null, tracking: null, rider: null, riderError: "", error: failure instanceof Error ? failure.message : "Failed to load order details.", checkedAt: "" });
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setRefreshing(false);
      }
    }
    void loadOrder();
    const visibleRefresh = () => { if (document.visibilityState === "visible") void loadOrder(); };
    const timer = window.setInterval(visibleRefresh, 30000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
    };
  }, [orderId, user?.id, key, revision]);

  useEffect(() => {
    setOpeningChat(false); setChatError("");
    return () => { chatRequest.current?.abort(); chatRequest.current = null; };
  }, [key]);

  const summary = useMemo(() => {
    if (!order) return null;
    const pricing = orderPricing(order);

    return {
      id: String(order.id ?? order.order_id ?? orderId ?? "-"),
      reference: String(order.order_number ?? order.orderNumber ?? order.OrderNumber ?? ""),
      status: String(order.status ?? "pending"),
      customer: customerName(order) || "Name not provided",
      buyerId: String(order.buyer_id ?? order.buyerId ?? order.BuyerID ?? ""),
      createdAt: String(order.created_at ?? order.createdAt ?? "-"),
      deliveryAddress: String(
        order.dropoff_address ?? order.delivery_address ?? order.address ?? "-"
      ),
      notes: String(order.notes ?? order.note ?? "-"),
      escrowStatus: escrowStatusFromOrder(order),
      sellerProceeds: pricing.issues.length ? null : pricing.sellerProceeds,
      paymentStatus: orderPaymentStatus(order),
    };
  }, [order, orderId]);

  const tracking = current?.tracking ?? (order ? orderDelivery(order) : null);
  async function openChat(contact: "buyer" | "rider") {
    if (!summary || !orderId || chatRequest.current) return;
    if (contact === "rider" && !tracking?.id) return;
    const controller = new AbortController();
    chatRequest.current = controller;
    setOpeningChat(true); setChatError("");
    try {
      const client = new ChatClient();
      const thread = contact === "buyer"
        ? await client.startOrder(orderId, summary.buyerId, controller.signal)
        : await client.startDelivery(tracking!.id, tracking!.riderId, controller.signal);
      if (!controller.signal.aborted) navigate(`/vendor/messages?conversationId=${encodeURIComponent(thread.id)}`);
    } catch (failure) {
      if (!controller.signal.aborted) setChatError(failure instanceof Error ? failure.message : `Could not open the ${contact} conversation. Please try again.`);
    } finally {
      if (!controller.signal.aborted) { chatRequest.current = null; setOpeningChat(false); }
    }
  }

  if (loading) {
    return (
      <section className={styles.card}>
        <div className={styles.cardTitle}>Loading order...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={styles.card}>
        <div className={styles.cardTitle}>Unable to load order</div>
        <div role="alert" className={styles.cardSubtitle}>{error}</div>
        <button type="button" className={styles.actionBtn} disabled={refreshing} onClick={() => setRevision(value => value + 1)}>Refresh tracking</button>
      </section>
    );
  }

  if (!summary) {
    return (
      <section className={styles.card}>
        <div className={styles.cardTitle}>Order not found</div>
      </section>
    );
  }

  return (
    <div className={detail.page}>
      <button type="button" className={detail.back} onClick={() => navigate("/vendor/orders")}><Icon name="chevron" size={14} />Back to orders</button>
      <header className={detail.hero}>
        <div><p className={detail.eyebrow}>Order Details</p><h1>{summary.reference || `Order #${summary.id.slice(-8).toUpperCase()}`}</h1>
          <p className={detail.date}>{Number.isFinite(Date.parse(summary.createdAt)) ? <>Placed <time dateTime={summary.createdAt}>{new Date(summary.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</time></> : "Order date not reported"}</p>
        </div>
        <div className={detail.badges}>
          <span className={detail.badge}><span className={detail.dot} /><span>{summary.status.replaceAll("_", " ")}</span></span>
          <span className={`${detail.badge} ${summary.paymentStatus === "paid" ? detail.paid : ""}`}>Payment: <span>{summary.paymentStatus.replaceAll("_", " ")}</span></span>
        </div>
      </header>

      <div className={detail.columns}>
        <div className={detail.main}>
          <section aria-label="Delivery and rider tracking" className={detail.panel}>
            <div className={detail.heading}><div className={detail.headingLabel}><span className={detail.icon}><Icon name="delivery" size={19} /></span><h2>Delivery &amp; rider</h2></div>
              <button type="button" className={detail.refresh} disabled={refreshing} onClick={() => setRevision(value => value + 1)}>{refreshing ? "Refreshing..." : "Refresh tracking"}</button>
            </div>
            {tracking?.required === false ? <p className={detail.muted}>No rider delivery is required for this order.</p> : <>
              <div className={detail.status}><span className={detail.icon}><Icon name="delivery" size={24} /></span><div><span className={detail.statusLabel}>Delivery status</span><strong>{tracking ? orderDeliveryLabel(tracking) : "Awaiting delivery update"}</strong></div></div>
              {current?.riderError ? <details className={detail.notice}><summary>Delivery tracking is unavailable to this account</summary><p role="alert">{current.riderError} Use Refresh tracking to check again.</p></details> : null}
              {tracking?.updatedAt && Number.isFinite(Date.parse(tracking.updatedAt)) ? <p className={detail.sync}>Delivery updated <time dateTime={tracking.updatedAt}>{new Date(tracking.updatedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time></p> : null}
            </>}
            {current?.checkedAt ? <p className={detail.sync}>Last checked <time dateTime={current.checkedAt}>{new Date(current.checkedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</time> · Updates every 30 seconds while visible</p> : null}
          </section>

          <section className={detail.panel} aria-label="Buyer and rider contacts">
            <div className={detail.heading}><div className={detail.headingLabel}><span className={detail.icon}><Icon name="accounts" size={18} /></span><h2>People &amp; delivery</h2></div></div>
            <div className={detail.contacts}>
              <div className={detail.contact}><p className={detail.contactLabel}>Buyer</p><p className={detail.contactName}>{summary.customer}</p><p className={detail.muted}>Questions about this order</p>
                <button type="button" aria-label="Chat with buyer" className={detail.chat} disabled={openingChat} onClick={() => void openChat("buyer")}><Icon name="chat" size={14} /><span>Chat with buyer</span></button>
              </div>
              {tracking?.required !== false ? <div className={detail.contact}><p className={detail.contactLabel}>Assigned rider</p><p className={detail.contactName}>{tracking?.riderId ? current?.rider?.name || "Assigned; name not reported" : "Rider assignment has not been reported."}</p>
                {tracking?.riderId ? <span className={detail.phone}>{current?.rider?.phone || "Not reported"}</span> : null}
                <button type="button" aria-label="Chat with rider" className={detail.chat} disabled={openingChat || !tracking?.id} onClick={() => void openChat("rider")}><Icon name="chat" size={14} /><span>Chat with rider</span></button>
              </div> : null}
            </div>
            {openingChat ? <p role="status" className={detail.muted}>Opening conversation...</p> : null}
            {chatError ? <p role="alert" className={detail.error}>{chatError}</p> : null}
            <div className={detail.address}><span className={detail.icon}><Icon name="delivery" size={17} /></span><div><p className={detail.contactLabel}>Delivery address</p><address>{summary.deliveryAddress}</address></div></div>
            {summary.notes && summary.notes !== "-" ? <div className={detail.notes}><p className={detail.contactLabel}>Order notes</p><p className={detail.muted}>{summary.notes}</p></div> : null}
          </section>
        </div>

        <aside className={detail.aside} aria-label="Seller earnings and escrow">
          <section className={`${detail.panel} ${detail.earnings}`}>
            <div className={detail.heading}><div className={detail.headingLabel}><span className={detail.icon}><Icon name="wallet" size={18} /></span><h2>Your earnings</h2></div></div>
            <p className={detail.eyebrow}>Seller proceeds</p><p className={detail.amount}>{pricingMoney(summary.sellerProceeds)}</p><p className={detail.muted}>Your share of this order</p>
            <div className={detail.escrow}><EscrowStatus status={summary.escrowStatus} sellerAmount={summary.sellerProceeds} /></div>
            <details className={detail.breakdown}><summary>Price breakdown</summary><OrderMoneyBreakdown pricing={orderPricing(order)} seller /></details>
            <button type="button" className={detail.wallet} onClick={() => navigate("/vendor/payments")}><Icon name="wallet" size={15} />Wallet &amp; payouts<Icon name="chevron" size={13} /></button>
          </section>
        </aside>
      </div>
      <details className={detail.reference}><summary>Order reference</summary><p>Order ID: {summary.id}</p></details>
    </div>
  );
}
