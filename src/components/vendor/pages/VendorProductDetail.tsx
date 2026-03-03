"use client";

import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { productsData } from "@/components/products/productData";
import "@/components/products/CreateProduct.css";

const variantRows = [
  { skuId: "#73423", variantId: "#73423", color: "Black", size: "L", visible: "1 x 80ml", status: "Active" },
  { skuId: "#73423", variantId: "#73423", color: "Black", size: "L", visible: "1 x 80ml", status: "Active" },
];

export default function VendorProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const product = useMemo(
    () => productsData.find((item) => item.id === productId),
    [productId]
  );

  if (!product) {
    return (
      <div className="create-card">
        <div className="section-title">Product not found</div>
      </div>
    );
  }

  return (
    <div className="create-page">
      <div className="create-card">
        <div className="create-header">
          <div className="create-title">
            <button
              type="button"
              className="back-btn"
              aria-label="Back"
              onClick={() => navigate(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <h1>Product Details</h1>
          </div>
          <button type="button" className="status-btn" onClick={() => navigate(`/vendor/products/${product.id}/edit`)}>
            Edit
          </button>
        </div>

        <section className="form-section">
          <div className="section-title">Basic Information</div>
          <div className="details-header">
            <div className="details-image" />
            <div className="details-info">
              <div className="details-name">{product.name}</div>
              <div className="details-meta">
                <span>Category Name</span>
                <span>{product.category}</span>
              </div>
            </div>
            <span className="badge-blue">{product.status}</span>
          </div>
          <div className="details-section">
            <div className="details-label">Short Description</div>
            <div className="details-text">
              Delivery usually takes 2–5 business days, depending on your location and the selected
              shipping method. You’ll receive a tracking number once your order is shipped.
            </div>
          </div>
          <div className="details-grid">
            <div className="details-card">
              <div className="details-icon">🏷️</div>
              <div>
                <div className="details-title">Brand</div>
                <div className="details-value">Brand Name</div>
              </div>
            </div>
            <div className="details-card">
              <div className="details-icon">🛒</div>
              <div>
                <div className="details-title">Slug</div>
                <div className="details-value">Slug Information</div>
              </div>
            </div>
            <div className="details-card">
              <div className="details-icon">👤</div>
              <div>
                <div className="details-title">Vendor</div>
                <div className="details-value">{product.vendor}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">Media</div>
          <div className="media-thumbs">
            {new Array(4).fill(null).map((_, index) => (
              <div className="media-thumb" key={`media-${index}`} />
            ))}
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">Variant</div>
          <div className="variant-table-wrap">
            <table className="variant-table">
              <thead>
                <tr>
                  <th>SKU ID</th>
                  <th>Variant ID</th>
                  <th>Image</th>
                  <th>Color</th>
                  <th>Size</th>
                  <th>Visible</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {variantRows.map((row, index) => (
                  <tr key={`variant-${index}`}>
                    <td>{row.skuId}</td>
                    <td>{row.variantId}</td>
                    <td>
                      <span className="thumb-sm" />
                    </td>
                    <td>{row.color}</td>
                    <td>{row.size}</td>
                    <td>{row.visible}</td>
                    <td>
                      <span className="badge-blue">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="form-section">
          <div className="section-title">Discount</div>
          <div className="details-grid">
            <div className="details-card">
              <div className="details-icon">🏷️</div>
              <div>
                <div className="details-title">Discount Title</div>
                <div className="details-value">-</div>
              </div>
            </div>
            <div className="details-card">
              <div className="details-icon">💵</div>
              <div>
                <div className="details-title">Discount Price</div>
                <div className="details-value">-</div>
              </div>
            </div>
            <div className="details-card">
              <div className="details-icon">📅</div>
              <div>
                <div className="details-title">Discount Duration</div>
                <div className="details-value">-</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
