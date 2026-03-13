"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import "@/components/products/ProductStock.css";

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const candidates = [payload.data, payload.products, payload.items, payload.rows];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return [];
}

function toNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

export default function ProductStock({ onAddStock = () => {}, onView = () => {} }) {
  const [rows, setRows] = useState([]);
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
        let payload = null;
        try {
          payload = text ? JSON.parse(text) : null;
        } catch {
          payload = text;
        }

        if (!response.ok) {
          const message =
            payload && typeof payload === "object" && "error" in payload
              ? payload.error
              : `Failed to load stock products (${response.status}).`;
          throw new Error(String(message));
        }

        const list = normalizeList(payload);
        const mapped = list.map((item, index) => {
          const id = item?.id || item?.product_id || item?.uuid || `product-${index}`;
          const stock = toNumber(item?.stock ?? item?.quantity, 0);
          const availability =
            stock <= 0 ? "Out of Stock" : stock <= 10 ? "Low Stock" : "Available stock";
          const price = toNumber(item?.basePrice ?? item?.price, 0);

          return {
            id,
            displayId: item?.displayId || item?.code || `#${String(id).slice(-5)}`,
            product: item?.name || item?.title || "Product",
            category:
              item?.category?.name ||
              item?.categoryName ||
              item?.category ||
              "Uncategorized",
            price: `N${price.toLocaleString()}`,
            quantity: `${stock} pcs`,
            availability,
            warehouse: item?.warehouse || item?.warehouse_code || "-",
            vendor: item?.seller?.name || item?.vendorName || "-",
            updated: item?.updated_at || item?.updatedAt || "-",
            status: item?.status || "unknown",
          };
        });
        setRows(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stock products.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const stats = useMemo(() => {
    const total = rows.length;
    const available = rows.filter((row) => row.availability === "Available stock").length;
    const low = rows.filter((row) => row.availability === "Low Stock").length;
    const out = rows.filter((row) => row.availability === "Out of Stock").length;
    return [
      { label: "Total Products", value: String(total) },
      { label: "In Stock Products", value: String(available) },
      { label: "Low Stock Products", value: String(low) },
      { label: "Out of Stock", value: String(out) },
    ];
  }, [rows]);

  return (
    <div className="stock-page">
      <div className="stock-card">
        <div className="stock-header">
          <h1>Stock Products</h1>
          <div className="stock-header-actions">
            <button className="btn-outline" type="button">Download</button>
            <button className="btn-primary" type="button" onClick={onAddStock}>Add Stock</button>
          </div>
        </div>

        {error ? <div className="product-error">{error}</div> : null}
        {loading ? <div className="product-loading">Loading stock data...</div> : null}

        <div className="stock-stats">
          {stats.map((item) => (
            <div className="stat-card" key={item.label}>
              <div className="stat-label">{item.label}</div>
              <div className="stat-value">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="table-wrap">
          {!loading && rows.length === 0 ? (
            <div className="product-empty">No stock products yet.</div>
          ) : null}
          {rows.length > 0 ? (
            <table className="stock-table">
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="Select all" /></th>
                  <th>ID</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Availability</th>
                  <th>Warehouse</th>
                  <th>Vendor</th>
                  <th>Last Updated</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td><input type="checkbox" aria-label={`Select ${row.product}`} /></td>
                    <td>{row.displayId}</td>
                    <td>
                      <div className="product-cell">
                        <span className="product-thumb" aria-hidden="true" />
                        <span className="product-name">{row.product}</span>
                      </div>
                    </td>
                    <td>{row.category}</td>
                    <td>{row.price}</td>
                    <td>{row.quantity}</td>
                    <td>
                      <span className={`pill ${row.availability.replace(/\s+/g, "-").toLowerCase()}`}>
                        {row.availability}
                      </span>
                    </td>
                    <td>{row.warehouse}</td>
                    <td>{row.vendor}</td>
                    <td>{row.updated}</td>
                    <td><span className="status-pill">{row.status}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-outline btn-sm"
                          type="button"
                          onClick={() => onView(row.id)}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </div>
  );
}
