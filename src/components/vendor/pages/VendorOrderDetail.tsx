"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import styles from "@/components/vendor/vendor.module.css";

function formatNaira(value: unknown) {
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
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrder() {
      if (!orderId) return;
      setLoading(true);
      setError("");
      try {
        const auth = getAuth();
        const token = auth?.access_token;
        const response = await fetch(`/api/seller/orders/${encodeURIComponent(orderId)}`, {
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
              : `Failed to load order (${response.status}).`;
          throw new Error(message);
        }

        const row =
          payload && typeof payload === "object"
            ? ((payload as Record<string, unknown>).data ??
                (payload as Record<string, unknown>).order ??
                (payload as Record<string, unknown>).item ??
                payload)
            : payload;

        setOrder(
          row && typeof row === "object" ? (row as Record<string, unknown>) : null
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load order details.");
        setOrder(null);
      } finally {
        setLoading(false);
      }
    }

    void loadOrder();
  }, [orderId]);

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
      amount: order.amount ?? order.total ?? order.total_amount ?? order.price ?? null,
      createdAt: String(order.created_at ?? order.createdAt ?? "-"),
      deliveryAddress: String(
        order.dropoff_address ?? order.delivery_address ?? order.address ?? "-"
      ),
      notes: String(order.notes ?? order.note ?? "-"),
    };
  }, [order, orderId]);

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
        <div className={styles.cardSubtitle}>{error}</div>
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

      <div className={styles.progressList}>
        <div className={styles.progressRow}>
          <span>Status</span>
          <span className={styles.pill}>{summary.status}</span>
        </div>
        <div className={styles.progressRow}>
          <span>Customer</span>
          <span>{summary.customer}</span>
        </div>
        <div className={styles.progressRow}>
          <span>Amount</span>
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
