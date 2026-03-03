"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "@/components/products/AddStock.css";

const initialForm = {
  product: "",
  hint: "",
  brand: "",
  variant: "",
  stockLevel: "",
  vendor: "",
  quantity: "",
  unit: "",
  salePrice: "",
  location: "",
  discountTitle: "",
  discountPrice: "",
  discountDuration: "",
};

export default function AddStock() {
  const [form, setForm] = useState(initialForm);
  const [discountEnabled, setDiscountEnabled] = useState(true);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    window.alert("Stock saved.");
  };

  return (
    <div className="stock-page">
      <div className="stock-card">
        <div className="stock-header">
          <div className="stock-title">
            <button type="button" className="back-btn" aria-label="Back" onClick={() => navigate(-1)}>
              <span aria-hidden="true">&lt;</span>
            </button>
            <h1>Add Stock</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="stock-form">
          <section className="form-section">
            <div className="section-title">Product</div>
            <div className="form-grid">
              <div className="field">
                <label>Product</label>
                <select name="product" value={form.product} onChange={handleChange}>
                  <option value="">Selected Product</option>
                  <option value="product-1">Product Name</option>
                </select>
              </div>
              <div className="field">
                <label>Hint</label>
                <select name="hint" value={form.hint} onChange={handleChange}>
                  <option value="">Hint</option>
                  <option value="hint-1">Hint</option>
                </select>
              </div>
              <div className="field">
                <label>Brand</label>
                <select name="brand" value={form.brand} onChange={handleChange}>
                  <option value="">Brand</option>
                  <option value="brand-1">Brand</option>
                </select>
              </div>
              <div className="field">
                <label>Variant</label>
                <select name="variant" value={form.variant} onChange={handleChange}>
                  <option value="">Variant</option>
                  <option value="variant-1">Variant</option>
                </select>
              </div>
              <div className="field">
                <label>Current Stock Level</label>
                <input
                  name="stockLevel"
                  value={form.stockLevel}
                  onChange={handleChange}
                  placeholder="400"
                />
              </div>
              <div className="field">
                <label>Vendor</label>
                <input
                  name="vendor"
                  value={form.vendor}
                  onChange={handleChange}
                  placeholder="Smart store"
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">Add Stock</div>
            <div className="form-grid">
              <div className="field">
                <label>New Quantity</label>
                <input
                  name="quantity"
                  value={form.quantity}
                  onChange={handleChange}
                  placeholder="New Quantity"
                />
              </div>
              <div className="field">
                <label>Unit</label>
                <input
                  name="unit"
                  value={form.unit}
                  onChange={handleChange}
                  placeholder="Unit"
                />
              </div>
              <div className="field">
                <label>Sale Price</label>
                <input
                  name="salePrice"
                  value={form.salePrice}
                  onChange={handleChange}
                  placeholder="Sale Price"
                />
              </div>
              <div className="field">
                <label>Location/Warehouse</label>
                <select name="location" value={form.location} onChange={handleChange}>
                  <option value="">Location/Warehouse</option>
                  <option value="wvr-001">WVR-001</option>
                </select>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-row">
              <div className="section-title">Discount</div>
              <button type="button" className="btn-outline">Add New Discount</button>
            </div>
            <div className="discount-toggle">
              <span>1 Discount</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={discountEnabled}
                  onChange={(event) => setDiscountEnabled(event.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
            {discountEnabled && (
              <div className="discount-fields">
                <div className="field">
                  <label>Discount Title</label>
                  <input
                    name="discountTitle"
                    value={form.discountTitle}
                    onChange={handleChange}
                    placeholder="Discount Title"
                  />
                </div>
                <div className="field">
                  <label>Discount Price</label>
                  <input
                    name="discountPrice"
                    value={form.discountPrice}
                    onChange={handleChange}
                    placeholder="Discount Price"
                  />
                </div>
                <div className="field">
                  <label>Discount Duration</label>
                  <input
                    name="discountDuration"
                    value={form.discountDuration}
                    onChange={handleChange}
                    placeholder="Discount Duration"
                  />
                </div>
                <button type="button" className="trash-btn" onClick={() => setDiscountEnabled(false)}>
                  <span aria-hidden="true">X</span>
                </button>
              </div>
            )}
          </section>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn-save">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
