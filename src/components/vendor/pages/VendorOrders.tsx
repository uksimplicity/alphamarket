"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import styles from "@/components/vendor/vendor.module.css";
import { pricingMoney } from "@/components/commerce/orderPricing";
import { loadSellerOrders } from "@/components/vendor/sellerOrders";
import { type SellerOrder } from "@/components/vendor/sellerData";

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
  const orders = snapshot.owner === user?.id ? snapshot.orders : null;

  useEffect(() => {
    const controller = new AbortController();
    async function loadOrders() {
      setLoading(true);
      setError("");
      setSnapshot({ owner: "", orders: null });
      try {
        const stamp = accountStamp();
        const auth = getAuth();
        if (!auth?.access_token || !auth.user?.id) throw new Error("Sign in with your seller account to view orders.");
        const owner = auth.user.id;
        const headers = { Authorization: `Bearer ${auth.access_token.replace(/^Bearer\s+/i, "").trim()}`, Accept: "application/json" };
        const rows = await loadSellerOrders(async path => {
          const response = await fetch(path, { headers, cache: "no-store", signal: controller.signal });
          const payload: unknown = await response.json();
          if (!response.ok) {
            const row = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
            throw new Error(typeof row.error === "string" ? row.error : typeof row.message === "string" ? row.message : `Failed to load orders (${response.status}).`);
          }
          return payload;
        }, owner);
        if (controller.signal.aborted) return;
        checkAccount(stamp);
        setSnapshot({ owner, orders: rows });
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Failed to load orders.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadOrders();
    return () => controller.abort();
  }, [user?.id, revision]);

  const summary = useMemo(() => ({
    total: orders?.length ?? "—",
    pending: orders ? orders.filter(item => item.status === "pending").length : "—",
    completed: orders ? orders.filter(item => ["completed", "delivered", "confirmed"].includes(item.status)).length : "—",
  }), [orders]);

  return (
    <>
      <section className={styles.gridStats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Orders</div>
          <div className={styles.statValue}>{summary.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Pending</div>
          <div className={styles.statValue}>{summary.pending}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Completed</div>
          <div className={styles.statValue}>{summary.completed}</div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>Orders</div>
          <button type="button" className={styles.actionBtn} disabled={loading} onClick={() => setRevision(value => value + 1)}>Refresh</button>
        </div>
        {loading ? <div className={styles.cardSubtitle}>Loading orders...</div> : null}
        {error ? <div role="alert" className={styles.cardSubtitle}>{error}</div> : null}
        {!loading && !error && orders?.length === 0 ? (
          <div className={styles.cardSubtitle}>No orders yet.</div>
        ) : null}
        {orders && orders.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Buyer total</th>
                  <th>Admin commission</th>
                  <th>Seller proceeds</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/vendor/orders/${encodeURIComponent(order.id)}`} className="text-brand">
                        {order.id}
                      </Link>
                    </td>
                    <td>{order.customer}</td>
                    <td>{pricingMoney(order.pricing.buyerTotal ?? order.amount)}</td>
                    <td>{pricingMoney(order.pricing.adminCommission)}</td>
                    <td>{pricingMoney(order.pricing.sellerProceeds)}</td>
                    <td>
                      <span className={styles.pill}>{order.status}</span>
                    </td>
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
