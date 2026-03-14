"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function formatNaira(value: number) {
  return nairaFormatter.format(value);
}

export default function VendorDashboard() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadProducts = useCallback(async () => {
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
        const record =
          row && typeof row === "object" ? (row as Record<string, unknown>) : {};
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
          price:
            record.basePrice ?? record.price
              ? toNumber(record.basePrice ?? record.price, 0)
              : null,
          status: String(record.status ?? "unknown"),
        } satisfies SellerProduct;
      });
      setProducts(normalized);
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load seller dashboard data."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

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

  const statusOptions = useMemo(() => {
    const entries = new Set<string>();
    products.forEach((product) => {
      entries.add(product.status.toLowerCase());
    });
    return Array.from(entries).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const statusPass =
        statusFilter === "all" || product.status.toLowerCase() === statusFilter;
      const queryPass =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);
      return statusPass && queryPass;
    });
  }, [products, searchQuery, statusFilter]);

  const recentProducts = useMemo(() => filteredProducts.slice(0, 8), [filteredProducts]);
  const lowStockProducts = useMemo(
    () =>
      [...products]
        .filter((product) => product.stock > 0 && product.stock <= 10)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5),
    [products]
  );

  const hasProducts = products.length > 0;
  const stockTracked = products.filter((product) => product.stock > 0).length;
  const safeStock = Math.max(stockTracked - metrics.lowStock, 0);

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Seller Overview</div>
            <div className={styles.cardSubtitle}>
              Live inventory snapshot for your storefront.
              {lastUpdatedAt ? ` Updated ${lastUpdatedAt.toLocaleTimeString()}.` : ""}
            </div>
          </div>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => void loadProducts()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        {error ? <div className={styles.cardSubtitle}>{error}</div> : null}
      </section>

      <section className={styles.gridStats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Products</div>
          <div className={styles.statValue}>{metrics.totalProducts}</div>
          <div className={styles.statDelta}>Catalog size</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Published</div>
          <div className={styles.statValue}>{metrics.published}</div>
          <div className={styles.statDelta}>Live listings</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Draft</div>
          <div className={styles.statValue}>{metrics.draft}</div>
          <div className={styles.statDelta}>Needs completion</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Low Stock</div>
          <div className={styles.statValue}>{metrics.lowStock}</div>
          <div className={styles.statDelta}>Needs restock soon</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Out of Stock</div>
          <div className={styles.statValue}>{metrics.outOfStock}</div>
          <div className={styles.statDelta}>No units left</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Inventory Value</div>
          <div className={styles.statValue}>{formatNaira(metrics.inventoryValue)}</div>
          <div className={styles.statDelta}>Estimated stock value</div>
        </div>
      </section>

      <section className={styles.gridWide}>
        <section className={styles.card}>
          <div className={styles.cardTitle}>Stock Health</div>
          <div className={styles.cardSubtitle}>Products grouped by inventory state.</div>
          <div className={styles.progressList}>
            <div className={styles.progressRow}>
              <span>Healthy stock</span>
              <span>{safeStock}</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: hasProducts ? `${(safeStock / Math.max(products.length, 1)) * 100}%` : "0%",
                }}
              />
            </div>

            <div className={styles.progressRow}>
              <span>Low stock</span>
              <span>{metrics.lowStock}</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: hasProducts ? `${(metrics.lowStock / Math.max(products.length, 1)) * 100}%` : "0%",
                }}
              />
            </div>

            <div className={styles.progressRow}>
              <span>Out of stock</span>
              <span>{metrics.outOfStock}</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: hasProducts ? `${(metrics.outOfStock / Math.max(products.length, 1)) * 100}%` : "0%",
                }}
              />
            </div>
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Quick Actions</div>
          <div className={styles.cardSubtitle}>Common seller tasks in one place.</div>
          <div className={styles.quickActions}>
            <Link to="/vendor/products/create" className={styles.actionBtn}>
              Add Product
            </Link>
            <Link to="/vendor/products/stock/add" className={styles.actionBtn}>
              Update Stock
            </Link>
            <Link to="/vendor/products/review" className={styles.actionBtn}>
              Review Queue
            </Link>
            <Link to="/vendor/products/draft" className={styles.actionBtn}>
              Finish Drafts
            </Link>
          </div>
          <div className={styles.cardSubtitle}>
            {lowStockProducts.length > 0
              ? `Priority restocks: ${lowStockProducts.map((item) => item.name).join(", ")}.`
              : "No urgent restocks at the moment."}
          </div>
        </section>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Products</div>
            <div className={styles.cardSubtitle}>
              Showing {recentProducts.length} of {filteredProducts.length} matching products.
            </div>
          </div>
          <div className={styles.tableFilters}>
            <input
              className={styles.filterInput}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name or category"
              aria-label="Search products"
            />
            <select
              className={styles.filterInput}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
        {loading ? <div className={styles.cardSubtitle}>Loading seller data...</div> : null}
        {!loading && !hasProducts ? (
          <div className={styles.cardSubtitle}>No seller products yet.</div>
        ) : null}
        {!loading && hasProducts && filteredProducts.length === 0 ? (
          <div className={styles.cardSubtitle}>
            No products match your filters. Try a different search or status.
          </div>
        ) : null}
        {recentProducts.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentProducts.map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.price === null ? "-" : formatNaira(product.price)}</td>
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
