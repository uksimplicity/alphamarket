"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "@/components/products/ProductReview.css";

const seedReviews = new Array(5).fill(null).map((_, index) => ({
  id: `73423-${index + 1}`,
  displayId: "#73423",
  product: "Product Name",
  vendor: "Jackob",
  review: "Good Fresh quality Product.",
  rating: 4,
  date: "01 Jul, 2022",
}));

function Stars({ value }) {
  return (
    <div className="stars" aria-label={`Rating ${value} out of 5`}>
      {new Array(5).fill(null).map((_, index) => (
        <span key={`star-${index}`} className={index < value ? "star filled" : "star"}>
          ?
        </span>
      ))}
    </div>
  );
}

export default function ProductReview() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState(seedReviews);

  const handleDelete = (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this item?");
    if (!confirmed) return;
    setReviews((prev) => prev.filter((row) => row.id !== id));
  };

  const data = useMemo(() => reviews, [reviews]);

  return (
    <div className="review-page">
      <div className="review-card">
        <div className="review-header">
          <h1>Product Review</h1>
        </div>

        <div className="review-filters">
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
            <select aria-label="Filter by rating">
              <option>Rating</option>
              <option>5 Stars</option>
              <option>4 Stars</option>
              <option>3 Stars</option>
            </select>
            <select aria-label="Filter by date">
              <option>Date</option>
              <option>Newest</option>
              <option>Oldest</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="review-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" aria-label="Select all" />
                </th>
                <th>ID</th>
                <th>Product</th>
                <th>Vendor</th>
                <th>Review</th>
                <th>Rating</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input type="checkbox" aria-label={`Select ${row.product}`} />
                  </td>
                  <td>{row.displayId}</td>
                  <td>
                    <div className="product-cell">
                      <span className="product-thumb" aria-hidden="true" />
                      <span className="product-name">{row.product}</span>
                    </div>
                  </td>
                  <td>{row.vendor}</td>
                  <td>{row.review}</td>
                  <td>
                    <Stars value={row.rating} />
                  </td>
                  <td>{row.date}</td>
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
                      <button className="icon-btn" type="button" aria-label="Refresh">
                        <svg viewBox="0 0 24 24">
                          <path
                            d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
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
