"use client";

import "@/components/products/ProductStock.css";

const stats = [
  { label: "Total Products", value: "5030" },
  { label: "In Stock Products", value: "120" },
  { label: "Low Stock Products", value: "384" },
  { label: "Out of Stock", value: "120" },
];

const rows = new Array(10).fill(null).map((_, index) => ({
  id: `73423-${index + 1}`,
  displayId: "#73423",
  product: "Product Name",
  category: "Fashion",
  price: "₦40,000",
  quantity: "82 pcs",
  availability: index % 3 === 1 ? "Low Stock" : index % 3 === 2 ? "Out of Stock" : "Available stock",
  warehouse: "WVR-001",
  vendor: "Eleanor Pena",
  updated: "01 Jul, 2022",
  status: "Published",
}));

export default function ProductStock({ onAddStock = () => {}, onView = (id) => {} }) {
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

        <div className="stock-stats">
          {stats.map((item) => (
            <div className="stat-card" key={item.label}>
              <div className="stat-label">{item.label}</div>
              <div className="stat-value">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="stock-filters">
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
            <select aria-label="Filter by status">
              <option>Status</option>
              <option>Published</option>
              <option>Draft</option>
            </select>
            <select aria-label="Filter by stock range">
              <option>Stock Range</option>
              <option>0-20</option>
              <option>21-50</option>
            </select>
            <select aria-label="Filter by date">
              <option>Date</option>
              <option>Newest</option>
              <option>Oldest</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
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
        </div>
      </div>
    </div>
  );
}
