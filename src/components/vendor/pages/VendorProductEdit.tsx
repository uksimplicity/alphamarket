"use client";

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import "@/components/products/CreateProduct.css";

export default function VendorProductEdit() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(() => ({
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
  }));
  const [variants, setVariants] = useState([{ variant: "", value: "" }]);
  const [discountEnabled, setDiscountEnabled] = useState(false);

  const loadProduct = async () => {
    if (!productId) return;
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const token = auth?.access_token;
      const response = await fetch(`/api/seller/products/${encodeURIComponent(productId)}`, {
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
            : `Failed to load product (${response.status}).`;
        throw new Error(String(message));
      }
      const payload =
        data?.data || data?.product || data?.item || data?.product_data || data || null;
      setProduct(payload);

      const firstDiscount = payload?.discounts?.[0] || null;
      setDiscountEnabled(Boolean(firstDiscount));
      setForm({
        name: payload?.name || payload?.title || "",
        slug: payload?.slug || "",
        category:
          payload?.categoryId ||
          payload?.category?.id ||
          payload?.category ||
          payload?.category_id ||
          "",
        type: payload?.productTypeId || payload?.type || "",
        brand: payload?.brandId || payload?.brand?.id || payload?.brand || "",
        vendor:
          payload?.sellerId ||
          payload?.vendorId ||
          payload?.seller?.id ||
          payload?.vendor?.id ||
          "",
        shortDescription:
          payload?.shortDescription ||
          payload?.short_description ||
          payload?.description ||
          "",
        tags: Array.isArray(payload?.tags) ? payload.tags.join(", ") : payload?.tags || "",
        discountTitle: firstDiscount?.title || "",
        discountPrice: firstDiscount?.price ?? "",
        discountDuration: firstDiscount?.startDate || firstDiscount?.endDate || "",
      });

      const attrs = Array.isArray(payload?.attributes) ? payload.attributes : [];
      if (attrs.length > 0) {
        setVariants(
          attrs.map((row: any) => ({
            variant: row?.attribute_id || row?.variant || "",
            value: row?.attribute_value_id || row?.value || "",
          }))
        );
      } else {
        setVariants([{ variant: "", value: "" }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product.");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [productId]);

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    try {
      const auth = getAuth();
      const token = auth?.access_token;
      const sellerId = auth?.user?.id;
      if (!token) {
        throw new Error("You must be logged in to update a product.");
      }

      const payload = {
        name: form.name,
        slug: form.slug,
        categoryId: form.category,
        productTypeId: form.type,
        brandId: form.brand,
        sellerId,
        shortDescription: form.shortDescription,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [],
        attributes: variants
          .filter((row) => row.variant && row.value)
          .map((row) => ({
            attribute_id: row.variant,
            attribute_value_id: row.value,
          })),
        discounts: discountEnabled
          ? [
              {
                active: true,
                title: form.discountTitle,
                price: Number(form.discountPrice) || 0,
                startDate: form.discountDuration,
                endDate: form.discountDuration,
              },
            ]
          : [],
      };

      setSaving(true);
      const response = await fetch(
        `/api/seller/products/${encodeURIComponent(productId ?? "")}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );
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
            : `Update failed (${response.status}).`;
        throw new Error(String(message));
      }
      setSuccess("Product updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  };

  const variantTableRows = useMemo(() => {
    const candidates = product?.variants || product?.variantRows || [];
    if (!Array.isArray(candidates)) return [];
    return candidates.map((row: any, index: number) => ({
      skuId: row?.skuId || row?.sku_id || row?.sku || `SKU-${index + 1}`,
      variantId: row?.variantId || row?.variant_id || row?.id || `VAR-${index + 1}`,
      color: row?.color || row?.colour || row?.attribute_value || row?.value || "-",
      size: row?.size || row?.size_name || "-",
      visible: row?.visible || row?.quantity || row?.stock || "-",
      status: row?.status || (row?.active ? "Active" : "Inactive"),
      image: row?.image || row?.imageUrl || row?.media || "",
    }));
  }, [product]);

  if (loading) {
    return (
      <div className="create-card">
        <div className="section-title">Loading product...</div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="create-card">
        <div className="section-title">Unable to load product</div>
        <div className="details-text">{error}</div>
      </div>
    );
  }

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
              <span aria-hidden="true">â†</span>
            </button>
            <h1>Edit Product</h1>
          </div>
          <button type="button" className="status-btn">
            Publish
            <span aria-hidden="true">â–¾</span>
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
                <span className="upload-icon">â†‘</span>
                <div className="upload-title">Upload Cover photo</div>
                <div className="upload-note">Allowed *.jpeg, *.jpg, *.png</div>
                <div className="upload-note">Max size 3 MB</div>
              </button>
              <button type="button" className="upload-card">
                <span className="upload-icon">â†‘</span>
                <div className="upload-title">Upload Product photo</div>
                <div className="upload-note">Allowed *.jpeg, *.jpg, *.png</div>
                <div className="upload-note">Max size 3 MB</div>
              </button>
              <button type="button" className="upload-card">
                <span className="upload-icon">â†‘</span>
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
                  {variantTableRows.length > 0 ? (
                    variantTableRows.map((row, index) => (
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
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>No variants found.</td>
                    </tr>
                  )}
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
              {form.tags
                ? form.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span className="tag-pill" key={tag}>
                        {tag}
                        <button type="button" aria-label={`Remove ${tag}`}>
                          Ã—
                        </button>
                      </span>
                    ))
                : null}
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
              <span>{discountEnabled ? "1 Discount" : "No Discount"}</span>
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
                <button
                  type="button"
                  className="trash-btn"
                  onClick={() => setDiscountEnabled(false)}
                >
                  <span aria-hidden="true">ðŸ—‘ï¸</span>
                </button>
              </div>
            )}
          </section>

          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
