"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import "@/components/products/ProductDraft.css";

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

export default function ProductDraft() {
  const navigate = useNavigate();
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
              : `Failed to load draft products (${response.status}).`;
          throw new Error(String(message));
        }

        const list = normalizeList(payload)
          .map((item, index) => {
            const status = String(item?.status ?? "").toLowerCase();
            return {
              id: item?.id || item?.product_id || item?.uuid || `product-${index}`,
              displayId: item?.displayId || item?.code || `#${String(item?.id || index).slice(-5)}`,
              product: item?.name || item?.title || "Product",
              category:
                item?.category?.name ||
                item?.categoryName ||
                item?.category ||
                "Uncategorized",
              price: `N${toNumber(item?.basePrice ?? item?.price, 0).toLocaleString()}`,
              vendor: item?.seller?.name || item?.vendorName || "-",
              status: item?.status || "unknown",
              rawStatus: status,
            };
          })
          .filter((row) => row.rawStatus.includes("draft"));

        setRows(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load draft products.");
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const handleDelete = (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this item?");
    if (!confirmed) return;
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const data = useMemo(() => rows, [rows]);

  return (
    <div className="draft-page">
      <div className="draft-card">
        <div className="draft-header">
          <h1>Draft Products</h1>
        </div>

        {error ? <div className="product-error">{error}</div> : null}
        {loading ? <div className="product-loading">Loading draft products...</div> : null}

        <div className="table-wrap">
          {!loading && data.length === 0 ? (
            <div className="product-empty">No draft products yet.</div>
          ) : null}
          {data.length > 0 ? (
            <table className="draft-table">
              <thead>
                <tr>
                  <th><input type="checkbox" aria-label="Select all" /></th>
                  <th>ID</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.id}>
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
                    <td>{row.vendor}</td>
                    <td><span className="draft-badge">{row.status}</span></td>
                    <td>
                      <div className="action-icons">
                        <button
                          className="icon-btn view"
                          type="button"
                          aria-label="View"
                          onClick={() => navigate(`/vendor/products/${row.id}`)}
                        >
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M12 5c-5 0-9 5-9 7s4 7 9 7 9-5 9-7-4-7-9-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                        <button
                          className="icon-btn edit"
                          type="button"
                          aria-label="Edit"
                          onClick={() => navigate(`/vendor/products/${row.id}/edit`)}
                        >
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                        <button
                          className="icon-btn delete"
                          type="button"
                          aria-label="Delete"
                          onClick={() => handleDelete(row.id)}
                        >
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M6 7h12l-1 14H7L6 7zm3-3h6l1 2H8l1-2zm-2 2h10v2H7V6z"
                              fill="currentColor"
                            />
                          </svg>
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
