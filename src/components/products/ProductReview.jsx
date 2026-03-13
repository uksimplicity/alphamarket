"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import "@/components/products/ProductReview.css";

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

function Stars({ value }) {
  return (
    <div className="stars" aria-label={`Rating ${value} out of 5`}>
      {new Array(5).fill(null).map((_, index) => (
        <span key={`star-${index}`} className={index < value ? "star filled" : "star"}>
          *
        </span>
      ))}
    </div>
  );
}

export default function ProductReview() {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
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
              : `Failed to load product reviews (${response.status}).`;
          throw new Error(String(message));
        }

        const list = normalizeList(payload);
        const mapped = list
          .map((item, index) => {
            const ratingRaw = item?.rating ?? item?.average_rating ?? item?.avg_rating;
            const rating = Number(ratingRaw);
            const hasRating = !Number.isNaN(rating) && rating > 0;
            const reviewText = item?.review || item?.latest_review || "";
            const hasReview = typeof reviewText === "string" && reviewText.trim().length > 0;
            if (!hasRating && !hasReview) return null;

            const id = item?.id || item?.product_id || item?.uuid || `product-${index}`;
            return {
              id: `${id}-${index}`,
              displayId: item?.displayId || item?.code || `#${String(id).slice(-5)}`,
              product: item?.name || item?.title || "Product",
              vendor: item?.seller?.name || item?.vendorName || "-",
              review: hasReview ? reviewText : "Rating available, no written review.",
              rating: hasRating ? Math.max(1, Math.min(5, Math.round(rating))) : 0,
              date: item?.updated_at || item?.created_at || "-",
              sourceProductId: String(id),
            };
          })
          .filter(Boolean);

        setReviews(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load product reviews.");
        setReviews([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const data = useMemo(() => reviews, [reviews]);

  return (
    <div className="review-page">
      <div className="review-card">
        <div className="review-header">
          <h1>Product Review</h1>
        </div>

        {error ? <div className="product-error">{error}</div> : null}
        {loading ? <div className="product-loading">Loading reviews...</div> : null}

        <div className="table-wrap">
          {!loading && data.length === 0 ? (
            <div className="product-empty">No review data available from seller products.</div>
          ) : null}
          {data.length > 0 ? (
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
                    <td>{row.rating > 0 ? <Stars value={row.rating} /> : "-"}</td>
                    <td>{row.date}</td>
                    <td>
                      <div className="action-icons">
                        <button
                          className="icon-btn view"
                          type="button"
                          aria-label="View"
                          onClick={() => navigate(`/vendor/products/${row.sourceProductId}`)}
                        >
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M12 5c-5 0-9 5-9 7s4 7 9 7 9-5 9-7-4-7-9-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
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
