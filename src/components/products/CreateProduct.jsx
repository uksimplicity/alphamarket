"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "@/components/products/CreateProduct.css";

const initialForm = {
  name: "",
  slug: "",
  category: "",
  type: "",
  brand: "",
  vendor: "",
  shortDescription: "",
  tags: "",
  discountTitle: "",
  discountPrice: "",
  discountDuration: "",
};

export default function CreateProduct() {
  const [form, setForm] = useState(initialForm);
  const [variants, setVariants] = useState([{ variant: "", value: "" }]);
  const [discountEnabled, setDiscountEnabled] = useState(true);
  const navigate = useNavigate();

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleTagsChange = (event) => {
    setForm((prev) => ({ ...prev, tags: event.target.value }));
  };

  const handleVariantChange = (index, field, value) => {
    setVariants((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { variant: "", value: "" }]);
  };

  const removeDiscount = () => {
    setForm((prev) => ({
      ...prev,
      discountTitle: "",
      discountPrice: "",
      discountDuration: "",
    }));
    setDiscountEnabled(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    window.alert("Product saved.");
  };

  const variantRows = useMemo(() => variants, [variants]);

  return (
    <div className="create-page">
      <div className="create-card">
        <div className="create-header">
          <div className="create-title">
            <button type="button" className="back-btn" aria-label="Back">
              <span aria-hidden="true">←</span>
            </button>
            <h1>Create Product</h1>
          </div>
          <button type="button" className="status-btn">
            Publish
            <span aria-hidden="true">▾</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-form">
          <section className="form-section">
            <div className="section-title">Basic Information</div>
            <div className="form-grid">
              <div className="field">
                <label>Product Name</label>
                <input name="name" value={form.name} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Slug</label>
                <input name="slug" value={form.slug} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Category</label>
                <select name="category" value={form.category} onChange={handleChange}>
                  <option value="">Select</option>
                  <option value="fashion">Fashion</option>
                  <option value="cloth">Cloth</option>
                </select>
              </div>
              <div className="field">
                <label>Product Type</label>
                <select name="type" value={form.type} onChange={handleChange}>
                  <option value="">Select</option>
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                </select>
              </div>
              <div className="field">
                <label>Brand</label>
                <select name="brand" value={form.brand} onChange={handleChange}>
                  <option value="">Select</option>
                  <option value="brand-a">Brand A</option>
                  <option value="brand-b">Brand B</option>
                </select>
              </div>
              <div className="field">
                <label>Vendor</label>
                <select name="vendor" value={form.vendor} onChange={handleChange}>
                  <option value="">Select</option>
                  <option value="sk-ibrahim">Sk Ibrahim</option>
                  <option value="jerome-bell">Jerome Bell</option>
                </select>
              </div>
            </div>
            <div className="field full">
              <label>Short Description</label>
              <textarea
                name="shortDescription"
                rows={3}
                value={form.shortDescription}
                onChange={handleChange}
              />
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">Media</div>
            <div className="media-grid">
              <button type="button" className="upload-card">
                <span className="upload-icon">↑</span>
                <div className="upload-title">Upload Cover photo</div>
                <div className="upload-note">Allowed *.jpeg, *.jpg, *.png</div>
                <div className="upload-note">Max size 3 MB</div>
              </button>
              <button type="button" className="upload-card">
                <span className="upload-icon">↑</span>
                <div className="upload-title">Upload Product photo</div>
                <div className="upload-note">Allowed *.jpeg, *.jpg, *.png</div>
                <div className="upload-note">Max size 3 MB</div>
              </button>
              <button type="button" className="upload-card">
                <span className="upload-icon">↑</span>
                <div className="upload-title">Upload Video</div>
                <div className="upload-note">Allowed *.mp4, *.mov, *.avi</div>
                <div className="upload-note">Max size 3 MB</div>
              </button>
            </div>
          </section>

          <section className="form-section">
            <div className="section-row">
              <div className="section-title">Variant</div>
              <button type="button" className="btn-outline" onClick={addVariant}>
                Add More Variant
              </button>
            </div>
            <div className="variant-grid">
              {variantRows.map((row, index) => (
                <div className="variant-row" key={`variant-${index}`}>
                  <select
                    value={row.variant}
                    onChange={(event) =>
                      handleVariantChange(index, "variant", event.target.value)
                    }
                  >
                    <option value="">Select Variant</option>
                    <option value="size">Size</option>
                    <option value="color">Color</option>
                  </select>
                  <select
                    value={row.value}
                    onChange={(event) =>
                      handleVariantChange(index, "value", event.target.value)
                    }
                  >
                    <option value="">Value</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                  </select>
                </div>
              ))}
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">Tags</div>
            <select
              className="tags-select"
              value={form.tags}
              onChange={handleTagsChange}
            >
              <option value="">Select Tags</option>
              <option value="new">New</option>
              <option value="featured">Featured</option>
              <option value="sale">Sale</option>
            </select>
          </section>

          <section className="form-section">
            <div className="section-row">
              <div className="section-title">Discount</div>
              <button type="button" className="btn-outline">
                Add New Discount
              </button>
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
                  />
                </div>
                <div className="field">
                  <label>Discount Price</label>
                  <input
                    type="number"
                    name="discountPrice"
                    value={form.discountPrice}
                    onChange={handleChange}
                  />
                </div>
                <div className="field">
                  <label>Discount Duration</label>
                  <input
                    type="text"
                    name="discountDuration"
                    placeholder="Select date range"
                    value={form.discountDuration}
                    onChange={handleChange}
                  />
                </div>
                <button type="button" className="trash-btn" onClick={removeDiscount}>
                  <span aria-hidden="true">🗑️</span>
                </button>
              </div>
            )}
          </section>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn-save">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
