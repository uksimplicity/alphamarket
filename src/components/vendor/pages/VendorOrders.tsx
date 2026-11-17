"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import styles from "@/components/vendor/vendor.module.css";
import { pricingMoney } from "@/components/commerce/orderPricing";
import { loadOrderCustomerNames, loadSellerOrders } from "@/components/vendor/sellerOrders";
import { needsFulfillment, type SellerOrder } from "@/components/vendor/sellerData";
import { orderDeliveryLabel } from "@/components/vendor/orderDelivery";

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
        setSnapshot({ owner, orders: namedRows });
        setError("");
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
    const timer = window.setInterval(visibleRefresh, 30000);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    return () => { controller.abort(); window.clearInterval(timer); window.removeEventListener("focus", visibleRefresh); document.removeEventListener("visibilitychange", visibleRefresh); };
  }, [user?.id, revision]);

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
        <p className={styles.cardSubtitle}>Delivery updates refresh every 30 seconds while this page is visible.</p>
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
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/vendor/orders/${encodeURIComponent(order.id)}`} className="text-brand">
                        {order.orderNumber || order.id}
                      </Link>
                    </td>
                    <td>{order.customer === "Customer" ? <Link to={`/vendor/orders/${encodeURIComponent(order.id)}`}>View customer details</Link> : order.customer}</td>
                    <td>{order.pricing.issues.length ? <span title={order.pricing.issues.join(" ")}>Pricing needs review</span> : pricingMoney(order.pricing.sellerProceeds)}</td>
                    <td><span className={styles.pill}>{order.paymentStatus.replaceAll("_", " ")}</span></td>
                    <td>
                      <span className={styles.pill}>{order.status}</span>
                    </td>
                    <td><span className={styles.pill}>{orderDeliveryLabel(order.delivery)}</span></td>
                    <td>{createdDate(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
