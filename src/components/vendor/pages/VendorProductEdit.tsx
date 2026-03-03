"use client";

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { productsData } from "@/components/products/productData";
import "@/components/products/CreateProduct.css";

const variantTableRows = [
  {
    skuId: "#73423",
    variantId: "#73423",
    color: "Black",
    size: "L",
    visible: "1 8x8ml",
    status: "Active",
  },
  {
    skuId: "#73423",
    variantId: "#73423",
    color: "Black",
    size: "M",
    visible: "1 8x8ml",
    status: "Active",
  },
];

export default function VendorProductEdit() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const product = useMemo(
    () => productsData.find((item) => item.id === productId),
    [productId]
  );

  const [form, setForm] = useState(() => ({
    name: product?.name ?? "",
    slug: "",
    category: product?.category ?? "",
    type: "",
    brand: "",
    vendor: product?.vendor ?? "",
    shortDescription: "",
    tags: "",
    discountTitle: "",
    discountPrice: "",
    discountDuration: "",
  }));
  const [variants, setVariants] = useState([{ variant: "", value: "" }]);
  const [discountEnabled, setDiscountEnabled] = useState(true);

  if (!product) {
    return (
      <div className="create-card">
        <div className="section-title">Product not found</div>
      </div>
    );
  }

  const handleChange = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLSelectElement>
      | React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleVariantChange = (index: number, field: "variant" | "value", value: string) => {
    setVariants((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { variant: "", value: "" }]);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.alert("Changes saved.");
  };

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
            <h1>Edit Product</h1>
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
              {variants.map((row, index) => (
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
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {variantTableRows.map((row, index) => (
                    <tr key={`row-${index}`}>
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
                      <td>
                        <button type="button" className="icon-btn view" aria-label="View">
                          <svg viewBox="0 0 24 24">
                            <path
                              d="M12 5c-5 0-9 5-9 7s4 7 9 7 9-5 9-7-4-7-9-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">Tags</div>
            <select className="tags-select" value={form.tags} onChange={handleChange} name="tags">
              <option value="">Select Tags</option>
              <option value="new">New</option>
              <option value="featured">Featured</option>
              <option value="sale">Sale</option>
            </select>
            <div className="tag-list">
              {["Tag 1", "Tag 2"].map((tag) => (
                <span className="tag-pill" key={tag}>
                  {tag}
                  <button type="button" aria-label={`Remove ${tag}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
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
                <button type="button" className="trash-btn" onClick={() => setDiscountEnabled(false)}>
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
