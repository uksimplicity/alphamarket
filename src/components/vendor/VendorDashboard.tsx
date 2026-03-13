"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import styles from "./vendor.module.css";

type SellerProduct = {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number | null;
  status: string;
};

function normalizeList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidates = [record.data, record.products, record.items, record.rows];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return [];
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

export default function VendorDashboard() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const auth = getAuth();
        const token = auth?.access_token;
        const response = await fetch("/api/seller/products", {
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
              : `Failed to load seller products (${response.status}).`;
          throw new Error(message);
        }

        const rows = normalizeList(payload);
        const normalized = rows.map((row, index) => {
          const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
          return {
            id: String(record.id ?? record.product_id ?? record.uuid ?? `product-${index}`),
            name: String(record.name ?? record.title ?? "Product"),
            category: String(
              (record.category && typeof record.category === "object"
                ? (record.category as Record<string, unknown>).name
                : null) ??
                record.category ??
                record.categoryName ??
                "Uncategorized"
            ),
            stock: toNumber(record.stock ?? record.quantity, 0),
            price: record.basePrice ?? record.price ? toNumber(record.basePrice ?? record.price, 0) : null,
            status: String(record.status ?? "unknown"),
          } satisfies SellerProduct;
        });
        setProducts(normalized);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load seller dashboard data.");
        setProducts([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const metrics = useMemo(() => {
    const totalProducts = products.length;
    const published = products.filter((product) => product.status.toLowerCase().includes("publish")).length;
    const draft = products.filter((product) => product.status.toLowerCase().includes("draft")).length;
    const lowStock = products.filter((product) => product.stock > 0 && product.stock <= 10).length;
    const outOfStock = products.filter((product) => product.stock <= 0).length;
    const inventoryValue = products.reduce((sum, product) => {
      if (product.price === null) return sum;
      return sum + product.price * Math.max(product.stock, 0);
    }, 0);

    return {
      totalProducts,
      published,
      draft,
      lowStock,
      outOfStock,
      inventoryValue,
    };
  }, [products]);

  const recentProducts = useMemo(() => products.slice(0, 8), [products]);

  return (
    <>
      {error ? <div className={styles.card}>{error}</div> : null}

      <section className={styles.gridStats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Products</div>
          <div className={styles.statValue}>{metrics.totalProducts}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Published</div>
          <div className={styles.statValue}>{metrics.published}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Draft</div>
          <div className={styles.statValue}>{metrics.draft}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Low Stock</div>
          <div className={styles.statValue}>{metrics.lowStock}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Out of Stock</div>
          <div className={styles.statValue}>{metrics.outOfStock}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Inventory Value</div>
          <div className={styles.statValue}>N{metrics.inventoryValue.toLocaleString()}</div>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardTitle}>Recent Products</div>
        {loading ? <div className={styles.cardSubtitle}>Loading seller data...</div> : null}
        {!loading && recentProducts.length === 0 ? (
          <div className={styles.cardSubtitle}>No seller products yet.</div>
        ) : null}
        {recentProducts.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.stock}</td>
                    <td>
                      <span className={styles.pill}>{product.status}</span>
                    </td>
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
