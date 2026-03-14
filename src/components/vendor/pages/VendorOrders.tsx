"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import styles from "@/components/vendor/vendor.module.css";

type SellerOrder = {
  id: string;
  customer: string;
  status: string;
  amount: number | null;
  createdAt: string;
};

function normalizeList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidates = [record.data, record.orders, record.items, record.rows];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return [];
}

function pickAmount(record: Record<string, unknown>) {
  const candidates = [record.amount, record.total, record.total_amount, record.price];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

function formatNaira(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function VendorOrders() {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      setLoading(true);
      setError("");
      try {
        const auth = getAuth();
        const token = auth?.access_token;
        const response = await fetch("/api/seller/orders", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const text = await response.text();
        let payload: unknown = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
          payload = text;
        }

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error: unknown }).error)
              : `Failed to load orders (${response.status}).`;
          throw new Error(message);
        }

        const rows = normalizeList(payload);
        const mapped = rows.map((row, index) => {
          const record =
            row && typeof row === "object" ? (row as Record<string, unknown>) : {};
          return {
            id: String(record.id ?? record.order_id ?? record.uuid ?? `order-${index}`),
            customer: String(
              record.customer_name ??
                record.customerName ??
                (record.customer && typeof record.customer === "object"
                  ? (record.customer as Record<string, unknown>).name
                  : null) ??
                "Customer"
            ),
            status: String(record.status ?? "pending"),
            amount: pickAmount(record),
            createdAt: String(record.created_at ?? record.createdAt ?? "-"),
          } satisfies SellerOrder;
        });

        setOrders(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders.");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }

    void loadOrders();
  }, []);

  const summary = useMemo(() => {
    return {
      total: orders.length,
      pending: orders.filter((item) => item.status.toLowerCase().includes("pend")).length,
      completed: orders.filter((item) => item.status.toLowerCase().includes("complete")).length,
    };
  }, [orders]);

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
        <div className={styles.cardTitle}>Orders</div>
        {loading ? <div className={styles.cardSubtitle}>Loading orders...</div> : null}
        {error ? <div className={styles.cardSubtitle}>{error}</div> : null}
        {!loading && !error && orders.length === 0 ? (
          <div className={styles.cardSubtitle}>No orders yet.</div>
        ) : null}
        {orders.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Amount</th>
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
                    <td>{formatNaira(order.amount)}</td>
                    <td>
                      <span className={styles.pill}>{order.status}</span>
                    </td>
                    <td>{order.createdAt}</td>
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
