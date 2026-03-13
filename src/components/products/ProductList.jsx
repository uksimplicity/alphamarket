"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";

export default function ProductList({
  onView = (id) => {},
  onEdit = (id) => {},
  onDelete = (id) => {},
  onCreate = () => {},
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const normalizeList = (payload) => {
    const list = Array.isArray(payload)
      ? payload
      : payload?.data || payload?.products || payload?.items || [];
    return Array.isArray(list) ? list : [];
  };

  const formatPrice = (value) => {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "number" && Number.isFinite(value)) {
      return `N${value.toLocaleString()}`;
    }
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return `N${numeric.toLocaleString()}`;
    }
    return String(value);
  };

  const toProductRow = (item, index) => {
    const id =
      item?.id ||
      item?.productId ||
      item?.product_id ||
      item?._id ||
      item?.uuid ||
      item?.slug ||
      String(index + 1);
    const displayId = item?.displayId || item?.code || `#${String(id).slice(-5)}`;
    return {
      id,
      displayId,
      name: item?.name || item?.title || "Product",
      category:
        item?.category?.name ||
        item?.categoryName ||
        item?.category ||
        item?.category_id ||
        item?.categoryId ||
        "-",
      price: formatPrice(item?.price ?? item?.basePrice ?? item?.amount ?? item?.unitPrice),
      vendor:
        item?.vendor?.name ||
        item?.vendorName ||
        item?.seller?.name ||
        item?.sellerName ||
        "-",
      status:
        item?.status ||
        (item?.isPublished ? "Publish" : item?.active === false ? "Draft" : "Publish"),
    };
  };

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const token = auth?.access_token;
      const response = await fetch("/api/seller/products", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? data.error
            : `Failed to load products (${response.status}).`;
        throw new Error(String(message));
      }
      const list = normalizeList(data);
      setRows(list.map(toProductRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this item?");
    if (!confirmed) return;
    setError("");
    try {
      const auth = getAuth();
      const token = auth?.access_token;
      if (!token) {
        throw new Error("You must be logged in to delete a product.");
      }
      setDeletingId(id);
      const response = await fetch(`/api/seller/products/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      if (!response.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? data.error
            : `Delete failed (${response.status}).`;
        throw new Error(String(message));
      }
      setRows((prev) => prev.filter((item) => item.id !== id));
      onDelete(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  };

  const products = useMemo(() => rows, [rows]);

  return (
    <div className="product-page">
      <div className="product-card">
        <div className="product-header">
          <h1>Product List</h1>
          <button className="btn-primary" type="button" onClick={onCreate}>
            Create Product
          </button>
        </div>

        {error ? <div className="product-error">{error}</div> : null}
        {loading ? <div className="product-loading">Loading products...</div> : null}

        <div className="product-filters">
          <div className="search-field">
            <span className="search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14zm0-2a9 9 0 1 0 5.65 16.01l4.17 4.17a1 1 0 0 0 1.42-1.42l-4.17-4.17A9 9 0 0 0 11 2z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <input type="text" placeholder="Search..." aria-label="Search" />
          </div>
          <div className="filter-group">
            <select aria-label="Filter by category">
              <option>Category</option>
              <option>Cloth</option>
              <option>Fashion</option>
            </select>
            <select aria-label="Filter by vendor">
              <option>Vendor</option>
              <option>Sk Ibrahim</option>
              <option>Jerome Bell</option>
            </select>
            <select aria-label="Filter by status">
              <option>Status</option>
              <option>Publish</option>
              <option>Draft</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          {!loading && products.length === 0 ? (
            <div className="product-empty">No products yet.</div>
          ) : null}
          {products.length > 0 ? (
            <table className="product-table">
              <thead>
                <tr>
                  <th>
                    <input type="checkbox" aria-label="Select all" />
                  </th>
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
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <input type="checkbox" aria-label={`Select ${product.name}`} />
                    </td>
                    <td>{product.displayId}</td>
                    <td>
                      <div className="product-cell">
                        <span className="product-thumb" aria-hidden="true" />
                        <span className="product-name">{product.name}</span>
                      </div>
                    </td>
                    <td>{product.category}</td>
                    <td>{product.price}</td>
                    <td>{product.vendor}</td>
                    <td>
                      <span className="status-badge">{product.status}</span>
                    </td>
                    <td>
                      <div className="action-icons">
                        <button
                          className="icon-btn view"
                          type="button"
                          aria-label="View"
                          onClick={() => onView(product.id)}
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
                          onClick={() => onEdit(product.id)}
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
                          onClick={() => handleDelete(product.id)}
                          disabled={deletingId === product.id}
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

        <div className="pagination">
          <button className="page-btn" type="button" aria-label="Previous page">
            <svg viewBox="0 0 24 24">
              <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
          <button className="page-number active" type="button">1</button>
          <button className="page-number" type="button">2</button>
          <button className="page-number" type="button">3</button>
          <span className="page-ellipsis">...</span>
          <button className="page-number" type="button">120</button>
          <button className="page-btn" type="button" aria-label="Next page">
            <svg viewBox="0 0 24 24">
              <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
