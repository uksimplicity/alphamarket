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
  createdAt: string;
};

type SellerOrder = {
  id: string;
  amount: number;
  status: string;
  customer: string;
  createdAt: string;
};

type DateRangeValue = "all" | "7d" | "30d" | "90d";

const dateRangeOptions: Array<{ value: DateRangeValue; label: string }> = [
  { value: "all", label: "All time" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

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

function toText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function buildAuthorizationHeader(token?: string) {
  const raw = String(token ?? "").trim();
  if (!raw) return "";
  return /^bearer\s+/i.test(raw) ? raw : `Bearer ${raw}`;
}

function getOwnerKeys(record: Record<string, unknown>) {
  return [
    record.seller_id,
    record.sellerId,
    record.vendor_id,
    record.vendorId,
    record.owner_id,
    record.ownerId,
    record.user_id,
    record.userId,
  ]
    .map((value) => toText(value))
    .filter(Boolean);
}

function matchesCurrentSeller(
  record: Record<string, unknown>,
  currentUserId: string,
  currentUserEmail: string
) {
  const keys = getOwnerKeys(record);
  if (keys.length === 0) return true;
  return keys.some(
    (value) =>
      value === currentUserId ||
      (currentUserEmail && value.toLowerCase() === currentUserEmail.toLowerCase())
  );
}

const nairaFormatter = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function formatNaira(value: number) {
  return nairaFormatter.format(value);
}

function formatDate(value: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getOrderStatusTone(status: string): "success" | "danger" | "warning" | "neutral" {
  const normalized = status.toLowerCase();
  if (normalized.includes("deliver") || normalized.includes("complete")) return "success";
  if (normalized.includes("cancel") || normalized.includes("fail")) return "danger";
  if (normalized.includes("pend") || normalized.includes("process")) return "warning";
  return "neutral";
}

function getDateRangeCutoff(value: DateRangeValue) {
  if (value === "all") return null;
  const days = value === "7d" ? 7 : value === "30d" ? 30 : 90;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function isWithinDateRange(value: string, cutoff: number | null) {
  if (cutoff === null) return true;
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return true;
  return timestamp >= cutoff;
}

export default function VendorDashboard() {
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRangeValue>("30d");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const token = buildAuthorizationHeader(auth?.access_token);
      const currentUserId = toText(auth?.user?.id);
      const currentUserEmail = toText(auth?.user?.email);
      const commonHeaders: Record<string, string> = {};
      if (token) commonHeaders.Authorization = token;

      const [productsResponse, ordersResponse] = await Promise.all([
        fetch("/api/seller/products", { headers: commonHeaders }),
        fetch("/api/seller/orders?limit=200&offset=0", { headers: commonHeaders }),
      ]);

      const [productsText, ordersText] = await Promise.all([
        productsResponse.text(),
        ordersResponse.text(),
      ]);

      let productsPayload: unknown = null;
      let ordersPayload: unknown = null;
      try {
        productsPayload = productsText ? JSON.parse(productsText) : null;
      } catch {
        productsPayload = productsText;
      }
      try {
        ordersPayload = ordersText ? JSON.parse(ordersText) : null;
      } catch {
        ordersPayload = ordersText;
      }

      if (!productsResponse.ok) {
        const message =
          productsPayload && typeof productsPayload === "object" && "error" in productsPayload
            ? String((productsPayload as { error: unknown }).error)
            : `Failed to load seller products (${productsResponse.status}).`;
        throw new Error(message);
      }

      const rows = normalizeList(productsPayload);
      const normalized = rows
        .map((row, index) => {
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
          createdAt: toText(record.created_at ?? record.createdAt ?? record.updated_at ?? record.updatedAt),
        } satisfies SellerProduct;
      })
        .filter((row, index) => {
          const source =
            rows[index] && typeof rows[index] === "object"
              ? (rows[index] as Record<string, unknown>)
              : null;
          if (!source) return true;
          return matchesCurrentSeller(source, currentUserId, currentUserEmail);
        });

      const orderRows = normalizeList(ordersPayload);
      const normalizedOrders = orderRows
        .map((row, index) => {
          const record =
            row && typeof row === "object" ? (row as Record<string, unknown>) : {};
          const customerName = toText(
            record.customer_name ??
              record.customerName ??
              (record.customer && typeof record.customer === "object"
                ? (record.customer as Record<string, unknown>).name
                : "")
          );
          const createdAt = toText(
            record.created_at ??
              record.createdAt ??
              record.ordered_at ??
              record.orderedAt
          );
          return {
            id: toText(record.id ?? record.order_id ?? record.uuid ?? `order-${index}`),
            amount: toNumber(record.amount ?? record.total_amount ?? record.total ?? 0, 0),
            status: toText(record.status ?? "unknown") || "unknown",
            customer: customerName || "Customer",
            createdAt,
          } satisfies SellerOrder;
        })
        .filter((order) => order.id);

      setProducts(normalized);
      setOrders(normalizedOrders);
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

  const dateRangeCutoff = useMemo(() => getDateRangeCutoff(dateRange), [dateRange]);
  const dateRangeLabel = useMemo(
    () => dateRangeOptions.find((option) => option.value === dateRange)?.label ?? "All time",
    [dateRange]
  );

  const dateScopedProducts = useMemo(
    () => products.filter((product) => isWithinDateRange(product.createdAt, dateRangeCutoff)),
    [products, dateRangeCutoff]
  );
  const dateScopedOrders = useMemo(
    () => orders.filter((order) => isWithinDateRange(order.createdAt, dateRangeCutoff)),
    [orders, dateRangeCutoff]
  );

  const metrics = useMemo(() => {
    const totalProducts = dateScopedProducts.length;
    const published = dateScopedProducts.filter((product) => product.status.toLowerCase().includes("publish")).length;
    const draft = dateScopedProducts.filter((product) => product.status.toLowerCase().includes("draft")).length;
    const lowStock = dateScopedProducts.filter((product) => product.stock > 0 && product.stock <= 10).length;
    const outOfStock = dateScopedProducts.filter((product) => product.stock <= 0).length;
    const inventoryValue = dateScopedProducts.reduce((sum, product) => {
      if (product.price === null) return sum;
      return sum + product.price * Math.max(product.stock, 0);
    }, 0);
    const totalOrders = dateScopedOrders.length;
    const fulfilledOrders = dateScopedOrders.filter((order) =>
      order.status.toLowerCase().includes("deliver") || order.status.toLowerCase().includes("complete")
    ).length;
    const orderRevenue = dateScopedOrders.reduce((sum, order) => sum + Math.max(order.amount, 0), 0);

    return {
      totalProducts,
      published,
      draft,
      lowStock,
      outOfStock,
      inventoryValue,
      totalOrders,
      fulfilledOrders,
      orderRevenue,
    };
  }, [dateScopedOrders, dateScopedProducts]);

  const statusOptions = useMemo(() => {
    const entries = new Set<string>();
    dateScopedProducts.forEach((product) => {
      entries.add(product.status.toLowerCase());
    });
    return Array.from(entries).sort();
  }, [dateScopedProducts]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return dateScopedProducts.filter((product) => {
      const statusPass =
        statusFilter === "all" || product.status.toLowerCase() === statusFilter;
      const queryPass =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.category.toLowerCase().includes(query);
      return statusPass && queryPass;
    });
  }, [dateScopedProducts, searchQuery, statusFilter]);

  const recentProducts = useMemo(() => filteredProducts.slice(0, 8), [filteredProducts]);
  const recentOrders = useMemo(
    () =>
      [...dateScopedOrders]
        .sort((a, b) => {
          const left = new Date(a.createdAt).getTime();
          const right = new Date(b.createdAt).getTime();
          if (Number.isNaN(left) && Number.isNaN(right)) return 0;
          if (Number.isNaN(left)) return 1;
          if (Number.isNaN(right)) return -1;
          return right - left;
        })
        .slice(0, 8),
    [dateScopedOrders]
  );
  const lowStockProducts = useMemo(
    () =>
      [...dateScopedProducts]
        .filter((product) => product.stock > 0 && product.stock <= 10)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 5),
    [dateScopedProducts]
  );

  const hasProducts = dateScopedProducts.length > 0;
  const stockTracked = dateScopedProducts.filter((product) => product.stock > 0).length;
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
          <div className={styles.tableFilters}>
            <select
              className={styles.filterInput}
              value={dateRange}
              onChange={(event) => setDateRange(event.target.value as DateRangeValue)}
              aria-label="Filter dashboard by date range"
            >
              {dateRangeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => void loadProducts()}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
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
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Total Orders</div>
          <div className={styles.statValue}>{metrics.totalOrders}</div>
          <div className={styles.statDelta}>Buyer activity</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Delivered Orders</div>
          <div className={styles.statValue}>{metrics.fulfilledOrders}</div>
          <div className={styles.statDelta}>Completed deliveries</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Order Revenue</div>
          <div className={styles.statValue}>{formatNaira(metrics.orderRevenue)}</div>
          <div className={styles.statDelta}>From seller orders</div>
        </div>
      </section>

      <section className={styles.gridWide}>
        <section className={styles.card}>
          <div className={styles.cardTitle}>Stock Health</div>
          <div className={styles.cardSubtitle}>
            Products grouped by inventory state for {dateRangeLabel.toLowerCase()}.
          </div>
          <div className={styles.progressList}>
            <div className={styles.progressRow}>
              <span>Healthy stock</span>
              <span>{safeStock}</span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: hasProducts ? `${(safeStock / Math.max(dateScopedProducts.length, 1)) * 100}%` : "0%",
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
                  width: hasProducts ? `${(metrics.lowStock / Math.max(dateScopedProducts.length, 1)) * 100}%` : "0%",
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
                  width: hasProducts ? `${(metrics.outOfStock / Math.max(dateScopedProducts.length, 1)) * 100}%` : "0%",
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
              Showing {recentProducts.length} of {filteredProducts.length} matching products in{" "}
              {dateRangeLabel.toLowerCase()}.
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
          <div className={styles.cardSubtitle}>No seller products found for this date range.</div>
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

      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div>
            <div className={styles.cardTitle}>Recent Orders</div>
            <div className={styles.cardSubtitle}>
              Latest {recentOrders.length} of {dateScopedOrders.length} seller orders in{" "}
              {dateRangeLabel.toLowerCase()}.
            </div>
          </div>
          <Link to="/vendor/orders" className={styles.actionBtn}>
            View all orders
          </Link>
        </div>
        {loading ? <div className={styles.cardSubtitle}>Loading order activity...</div> : null}
        {!loading && dateScopedOrders.length === 0 ? (
          <div className={styles.cardSubtitle}>No orders found for this date range.</div>
        ) : null}
        {!loading && recentOrders.length > 0 ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const tone = getOrderStatusTone(order.status);
                  const toneClass =
                    tone === "success"
                      ? styles.pillSuccess
                      : tone === "danger"
                      ? styles.pillDanger
                      : tone === "warning"
                      ? styles.pillWarning
                      : "";

                  return (
                    <tr key={order.id}>
                      <td>{order.id}</td>
                      <td>{order.customer}</td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>{formatNaira(order.amount)}</td>
                      <td>
                        <span className={`${styles.pill} ${toneClass}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        <Link to={`/vendor/orders/${order.id}`} className={styles.actionBtn}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </>
  );
}
