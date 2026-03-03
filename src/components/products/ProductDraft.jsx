"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "@/components/products/ProductDraft.css";

const seedRows = new Array(12).fill(null).map((_, index) => ({
  id: `73423-${index + 1}`,
  displayId: "#73423",
  product: "Product Name",
  category: "Fashion",
  price: "₦40,000",
  vendor: "Devon Lane",
  status: "Draft",
}));

export default function ProductDraft() {
  const navigate = useNavigate();
  const [rows, setRows] = useState(seedRows);

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

        <div className="draft-filters">
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
              <option>Fashion</option>
              <option>Cloth</option>
            </select>
            <select aria-label="Filter by vendor">
              <option>Vendor</option>
              <option>Devon Lane</option>
            </select>
            <select aria-label="Filter by status">
              <option>Status</option>
              <option>Draft</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
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
