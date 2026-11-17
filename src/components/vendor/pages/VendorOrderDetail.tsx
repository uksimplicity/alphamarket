"use client";

import { useEffect, useMemo, useState } from "react";
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
import { orderPricing } from "@/components/commerce/orderPricing";
import { sellerOrderDetail } from "@/components/vendor/sellerOrders";
import styles from "@/components/vendor/vendor.module.css";

function formatNaira(value: unknown) {
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "string" && !value.trim()) return "Not reported";
  const numeric = Number(value);
  if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(numeric);
  }
  return "-";
}

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

  const summary = useMemo(() => {
    if (!order) return null;

    const customerRecord =
      order.customer && typeof order.customer === "object"
        ? (order.customer as Record<string, unknown>)
        : null;

    return {
      id: String(order.id ?? order.order_id ?? orderId ?? "-"),
      status: String(order.status ?? "pending"),
      customer: String(order.customer_name ?? customerRecord?.name ?? "Customer"),
      amount: orderPricing(order).buyerTotal,
      createdAt: String(order.created_at ?? order.createdAt ?? "-"),
      deliveryAddress: String(
        order.dropoff_address ?? order.delivery_address ?? order.address ?? "-"
      ),
      notes: String(order.notes ?? order.note ?? "-"),
      escrowStatus: escrowStatusFromOrder(order),
      paymentStatus: orderPaymentStatus(order),
    };
  }, [order, orderId]);

  const tracking = current?.tracking ?? (order ? orderDelivery(order) : null);

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
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>Order Details</div>
          <div className={styles.cardSubtitle}>Order ID: {summary.id}</div>
        </div>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => navigate("/vendor/orders")}
        >
          Back to orders
        </button>
      </div>

      <section aria-label="Delivery and rider tracking" className={styles.progressList}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Delivery &amp; rider</h2>
          <button type="button" className={styles.actionBtn} disabled={refreshing} onClick={() => setRevision(value => value + 1)}>
            {refreshing ? "Refreshing..." : "Refresh tracking"}
          </button>
        </div>
        {tracking?.required === false ? <p>No rider delivery is required for this order.</p> : <>
          <div className={styles.progressRow}><span>Delivery status</span><span className={styles.pill}>{tracking ? orderDeliveryLabel(tracking) : "Awaiting delivery update"}</span></div>
          <div className={styles.progressRow}><span>Assigned rider</span><span>{tracking?.riderId ? current?.rider?.name || "Assigned; name not reported" : "Rider assignment has not been reported."}</span></div>
          {tracking?.riderId ? <div className={styles.progressRow}><span>Rider contact</span><span>{current?.rider?.phone || "Not reported"}</span></div> : null}
          {current?.riderError ? <p role="alert">{current.riderError} Use Refresh tracking to check again.</p> : null}
          {tracking?.updatedAt && Number.isFinite(Date.parse(tracking.updatedAt)) ? <div className={styles.progressRow}><span>Delivery updated</span><time dateTime={tracking.updatedAt}>{new Date(tracking.updatedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time></div> : null}
        </>}
        {current?.checkedAt ? <p className={styles.cardSubtitle}>Last checked: <time dateTime={current.checkedAt}>{new Date(current.checkedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time>. Updates every 30 seconds while this page is visible.</p> : null}
      </section>

      <div className={styles.progressList}>
        <OrderMoneyBreakdown pricing={orderPricing(order)} seller />
        <EscrowStatus status={summary.escrowStatus} />
        <div className={styles.progressRow}><span>Payment status</span><span className={styles.pill}>{summary.paymentStatus}</span></div>
        <div className={styles.progressRow}>
          <span>Status</span>
          <span className={styles.pill}>{summary.status}</span>
        </div>
        <div className={styles.progressRow}>
          <span>Customer</span>
          <span>{summary.customer}</span>
        </div>
        <div className={styles.progressRow}>
          <span>Buyer total</span>
          <span>{formatNaira(summary.amount)}</span>
        </div>
        <div className={styles.progressRow}>
          <span>Created</span>
          <span>{summary.createdAt}</span>
        </div>
        <div className={styles.progressRow}>
          <span>Delivery Address</span>
          <span>{summary.deliveryAddress}</span>
        </div>
        <div className={styles.progressRow}>
          <span>Notes</span>
          <span>{summary.notes}</span>
        </div>
      </div>
    </section>
  );
}
