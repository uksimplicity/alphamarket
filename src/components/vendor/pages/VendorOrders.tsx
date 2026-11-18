"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { authGeneration, getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import styles from "@/components/vendor/vendor.module.css";
import { pricingMoney } from "@/components/commerce/orderPricing";
import { loadOrderCustomerNames, loadSellerOrders } from "@/components/vendor/sellerOrders";
import { needsFulfillment, type SellerOrder } from "@/components/vendor/sellerData";
import { orderDeliveryLabel } from "@/components/vendor/orderDelivery";
import { loadOrderRiderTracking } from "@/components/commerce/orderRiderTracking";
import { firstName } from "@/components/commerce/firstName";
import { notificationPage, notificationRequest, type Notification } from "@/components/notifications/notificationClient";
import { latestDeliveryNotice } from "@/components/notifications/deliveryNoticeSelection";

function createdDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" })
    : "—";
}

export default function VendorOrders() {
  const user = useAuthUser();
  const [snapshot, setSnapshot] = useState<{ owner: string; orders: SellerOrder[] | null }>({ owner: "", orders: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const session = `${user?.id || ""}:${authGeneration()}`;
  const [updates, setUpdates] = useState<{ session: string; items: Notification[] }>({ session: "", items: [] });
  const orders = snapshot.owner === user?.id ? snapshot.orders : null;

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;
    setLoading(true);
    setError("");
    setSnapshot({ owner: "", orders: null });
    async function loadOrders() {
      if (inFlight || controller.signal.aborted) return;
      inFlight = true;
      setRefreshing(true);
      try {
        const stamp = accountStamp();
        const auth = getAuth();
        if (!auth?.access_token || !auth.user?.id) throw new Error("Sign in with your seller account to view orders.");
        const owner = auth.user.id;
        const headers = { Authorization: `Bearer ${auth.access_token.replace(/^Bearer\s+/i, "").trim()}`, Accept: "application/json" };
        const request = async (path: string) => {
          controller.signal.throwIfAborted();
          checkAccount(stamp);
          const response = await fetch(path, { headers, cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) });
          const payload: unknown = await response.json();
          checkAccount(stamp);
          if (!response.ok) {
            const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
            throw new Error(typeof row.error === "string" ? row.error : typeof row.message === "string" ? row.message : `Failed to load orders (${response.status}).`);
          }
          return payload;
        };
        const rows = await loadSellerOrders(request, owner);
        if (controller.signal.aborted) return;
        setSnapshot({ owner, orders: rows });
        const namedRows = await loadOrderCustomerNames(request, rows);
        if (controller.signal.aborted) return;
        checkAccount(stamp);
        const enriched = await Promise.all(namedRows.map(async order => {
          const result = await loadOrderRiderTracking(request, order.delivery, order.id, false);
          return { ...order, delivery: result.tracking, deliveryError: result.riderError };
        }));
        if (controller.signal.aborted) return;
        checkAccount(stamp);
        setSnapshot({ owner, orders: enriched });
        setError("");
        if (enriched.some(order => order.deliveryError && !order.delivery.status && order.delivery.required !== false)) {
          try {
            const payload = await notificationRequest("?limit=100&offset=0", "GET", controller.signal);
            checkAccount(stamp);
            if (!controller.signal.aborted) setUpdates({ session, items: notificationPage(payload, 100, 0).items });
          } catch {
            if (!controller.signal.aborted) { try { checkAccount(stamp); setUpdates({ session, items: [] }); } catch { /* Account changed. */ } }
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load orders.");
        setSnapshot({ owner: "", orders: null });
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) { setLoading(false); setRefreshing(false); }
      }
    }
    void loadOrders();
    const visibleRefresh = () => { if (document.visibilityState === "visible") void loadOrders(); };
    const timer = window.setInterval(visibleRefresh, 15000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", visibleRefresh); document.removeEventListener("visibilitychange", visibleRefresh); };
  }, [user?.id, revision, session]);

  const summary = useMemo(() => ({
    total: orders?.length ?? "—",
    awaitingPayment: orders ? orders.filter(item => item.paymentStatus === "pending" && !["cancelled", "returned", "failed", "failed_delivery", "completed", "delivered", "confirmed"].includes(item.status)).length : "—",
    fulfillment: orders ? orders.filter(needsFulfillment).length : "—",
    completed: orders ? orders.filter(item => ["completed", "delivered", "confirmed"].includes(item.status)).length : "—",
  }), [orders]);

  return (
    <>
      <section className={`${styles.gridStats} ${styles.orderStats}`}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Orders</div>
          <div className={styles.statValue}>{summary.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Awaiting payment</div>
          <div className={styles.statValue}>{summary.awaitingPayment}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Paid — awaiting fulfillment</div>
          <div className={styles.statValue}>{summary.fulfillment}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed</div>
          <div className={styles.statValue}>{summary.completed}</div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Orders</div>
          <button type="button" className={styles.actionBtn} disabled={loading || refreshing} onClick={() => setRevision(value => value + 1)}>{refreshing ? "Refreshing..." : "Refresh"}</button>
        </div>
        {loading ? <div className={styles.cardSubtitle}>Loading orders...</div> : null}
        {error ? <div role="alert" className={styles.cardSubtitle}>{error}</div> : null}
        <p className={styles.cardSubtitle}>Delivery updates are checked every 15 seconds while this page is visible.</p>
        {!loading && !error && orders?.length === 0 ? (
          <div className={styles.cardSubtitle}>No orders yet.</div>
        ) : null}
        {orders && orders.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order reference</th>
                  <th>Customer</th>
                  <th>Seller proceeds</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Delivery</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const update = order.deliveryError && !order.delivery.status && order.delivery.required !== false && updates.session === session ? latestDeliveryNotice(updates.items, order.id) : null;
                  return (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/vendor/orders/${encodeURIComponent(order.id)}`} className="text-brand">
                        {order.orderNumber || order.id}
                      </Link>
                    </td>
                    <td>{order.customer === "Customer" ? <Link className={styles.customerDetailsLink} to={`/vendor/orders/${encodeURIComponent(order.id)}`} aria-label={`View customer details for order ${order.orderNumber || order.id}`}>View customer details <span aria-hidden="true">↗</span></Link> : firstName(order.customer)}</td>
                    <td>{order.pricing.issues.length ? <span title={order.pricing.issues.join(" ")}>Pricing needs review</span> : pricingMoney(order.pricing.sellerProceeds)}</td>
                    <td><span className={styles.pill}>{order.paymentStatus.replaceAll("_", " ")}</span></td>
                    <td>
                      <span className={styles.pill}>{order.status}</span>
                    </td>
                    <td><span className={styles.pill}>{update?.title || (order.deliveryError && !order.delivery.status ? "Tracking unavailable" : orderDeliveryLabel(order.delivery))}</span>{update ? <small className={styles.deliveryUpdateTime}>Updated <time dateTime={update.date}>{new Date(update.date).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time></small> : order.deliveryError && order.delivery.status ? <small> Latest update unavailable</small> : null}</td>
                    <td>{createdDate(order.createdAt)}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
