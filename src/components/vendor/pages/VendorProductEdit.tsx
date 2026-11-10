"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { asRecord, editedMedia, referenceOptions, uploadProductMedia, type ReferenceOption } from "../sellerProductForm";
import "@/components/products/CreateProduct.css";

export default function VendorProductEdit() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [references, setReferences] = useState<Record<string, ReferenceOption[]>>({});
  const [attributeValues, setAttributeValues] = useState<Record<string, ReferenceOption[]>>({});
  const [catalogError, setCatalogError] = useState("");

  const [form, setForm] = useState(() => ({
    name: "",
    slug: "",
    category: "",
    type: "",
    brand: "",
    vendor: "",
    basePrice: "",
    stock: "",
    shortDescription: "",
    tags: "",
    discountTitle: "",
    discountPrice: "",
    discountDuration: "",
  }));
  const [variants, setVariants] = useState([{ variant: "", value: "" }]);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const MAX_PRODUCT_PRICE = 1000000000;
  const MAX_PRODUCT_STOCK = 1000000;

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const token = auth?.access_token;
      const stamp = accountStamp();
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
      checkAccount(stamp);
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
        type: payload?.productTypeId || payload?.product_type_id || payload?.productType?.id || payload?.type || "",
        brand: payload?.brandId || payload?.brand_id || payload?.brand?.id || payload?.brand || "",
        vendor:
          payload?.sellerId ||
          payload?.vendorId ||
          payload?.seller?.id ||
          payload?.vendor?.id ||
          "",
        basePrice: String(
          payload?.basePrice ??
            payload?.base_price ??
            payload?.price ??
            payload?.amount ??
            payload?.unitPrice ??
            ""
        ),
        stock: String(payload?.stock ?? payload?.quantity ?? ""),
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
          attrs.map((row: unknown) => {
            const record =
              row && typeof row === "object" ? (row as Record<string, unknown>) : {};
            return {
              variant: String(record.attribute_id ?? record.variant ?? ""),
              value: String(record.attribute_value_id ?? record.value ?? ""),
            };
          })
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
  }, [productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    let active = true;
    const stamp = accountStamp();
    const headers = { Authorization: `Bearer ${getAuth()?.access_token}` };
    Promise.all(["categories", "product-types", "brands", "attributes"].map(async resource => {
      const response = await fetch(`/api/seller/catalog?resource=${resource}&limit=200`, { headers });
      if (!response.ok) throw new Error("Some product choices could not be loaded. Your existing selections are preserved.");
      return [resource, referenceOptions(await response.json())] as const;
    })).then(entries => { checkAccount(stamp); if (active) setReferences(Object.fromEntries(entries)); })
      .catch(error => { if (active) setCatalogError(error.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const stamp = accountStamp();
    const ids = [...new Set(variants.map(row => row.variant).filter(Boolean))];
    Promise.all(ids.map(async id => {
      const response = await fetch(`/api/seller/catalog?resource=attributes&id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${getAuth()?.access_token}` } });
      if (!response.ok) throw new Error("Variant choices could not be loaded. Your existing selections are preserved.");
      const payload = await response.json(), row = asRecord(asRecord(payload).data ?? payload);
      return [id, referenceOptions(row.values ?? row.attribute_values ?? row.attributeValues)] as const;
    })).then(entries => { checkAccount(stamp); if (active) setAttributeValues(Object.fromEntries(entries)); })
      .catch(error => { if (active) setCatalogError(error.message); });
    return () => { active = false; };
  }, [variants]);

  const options = (resource: string, current: string) => {
    const rows = references[resource] ?? [];
    return <>{current && !rows.some(row => row.id === current) ? <option value={current}>Current selection</option> : null}{rows.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</>;
  };

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
      prev.map((item, i) => (i === index ? { ...item, [field]: value, ...(field === "variant" ? { value: "" } : {}) } : item))
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
      const stamp = accountStamp();
      const auth = getAuth();
      const token = auth?.access_token;
      const sellerId = auth?.user?.id;
      if (!token) {
        throw new Error("You must be logged in to update a product.");
      }
      if (!form.name.trim()) {
        throw new Error("Product name is required.");
      }
      if (!form.shortDescription.trim()) {
        throw new Error("Product description is required.");
      }

      const numericPrice = Number(form.basePrice);
      if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
        throw new Error("Base price must be greater than 0.");
      }
      if (numericPrice > MAX_PRODUCT_PRICE) {
        throw new Error(`Base price is too large. Maximum is ${MAX_PRODUCT_PRICE.toLocaleString()}.`);
      }

      const numericStock = Number(form.stock || 0);
      if (!Number.isInteger(numericStock) || numericStock < 0) {
        throw new Error("Stock must be a whole number of zero or more.");
      }
      if (numericStock > MAX_PRODUCT_STOCK) {
        throw new Error(`Stock is too large. Maximum is ${MAX_PRODUCT_STOCK.toLocaleString()}.`);
      }

      const uploadImage = (file: File) => uploadProductMedia(file, token);

      const payload = {
        name: form.name,
        slug: form.slug,
        categoryId: form.category,
        productTypeId: form.type,
        brandId: form.brand,
        sellerId,
        basePrice: Number(form.basePrice) || 0,
        stock: form.stock === "" ? 0 : Number(form.stock) || 0,
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
      } as Record<string, unknown>;

      setSaving(true);
      if (coverFile || imageFiles.length > 0) {
        const coverUrl = coverFile ? await uploadImage(coverFile) : undefined;
        const imageUrls = imageFiles.length
          ? (await Promise.all(imageFiles.map((file) => uploadImage(file)))).filter(Boolean)
          : undefined;
        payload.media = editedMedia(product ?? {}, coverUrl, imageUrls);
      }
      checkAccount(stamp);
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
      checkAccount(stamp);
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
    return candidates.map((row, index: number) => {
      const record =
        row && typeof row === "object" ? (row as Record<string, unknown>) : {};
      return {
        skuId: String(record.skuId ?? record.sku_id ?? record.sku ?? `SKU-${index + 1}`),
        variantId: String(
          record.variantId ?? record.variant_id ?? record.id ?? `VAR-${index + 1}`
        ),
        color: String(record.color ?? record.colour ?? record.attribute_value ?? record.value ?? "-"),
        size: String(record.size ?? record.size_name ?? "-"),
        visible: String(record.visible ?? record.quantity ?? record.stock ?? "-"),
        status: String(record.status ?? (record.active ? "Active" : "Inactive")),
        image: String(record.image ?? record.imageUrl ?? record.media ?? ""),
      };
    });
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
              <span aria-hidden="true">{"\u2190"}</span>
            </button>
            <h1>Edit Product</h1>
          </div>
          <button type="button" className="status-btn">
            Publish
            <span aria-hidden="true">{"\u25be"}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="create-form">
          {catalogError ? <p role="alert">{catalogError}</p> : null}
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
                  {options("categories", form.category)}
                </select>
              </div>
              <div className="field">
                <label>Product Type</label>
                <select name="type" value={form.type} onChange={handleChange}>
                  <option value="">Select</option>
                  {options("product-types", form.type)}
                </select>
              </div>
              <div className="field">
                <label>Brand</label>
                <select name="brand" value={form.brand} onChange={handleChange}>
                  <option value="">Select</option>
                  {options("brands", form.brand)}
                </select>
              </div>
              <div className="field">
                <label>Vendor</label>
                <input value="Your seller account" readOnly />
              </div>
              <div className="field">
                <label>Base Price</label>
                <input
                  type="number"
                  name="basePrice"
                  value={form.basePrice}
                  onChange={handleChange}
                />
                <p className="helper-text">Enter your selling price. You receive this full price. Admin commission and delivery are added to the buyer total.</p>
              </div>
              <div className="field">
                <label>Stock</label>
                <input
                  type="number"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                />
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
              <label className="upload-card">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                />
                <span className="upload-icon">â†‘</span>
                <div className="upload-title">Upload Cover photo</div>
                <div className="upload-note">Allowed image types</div>
                <div className="upload-note">Max size 3 MB</div>
                {coverFile ? <div className="upload-note">{coverFile.name}</div> : null}
              </label>
              <label className="upload-card">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) =>
                    setImageFiles(event.target.files ? Array.from(event.target.files) : [])
                  }
                />
                <span className="upload-icon">â†‘</span>
                <div className="upload-title">Upload Product photo</div>
                <div className="upload-note">Allowed image types</div>
                <div className="upload-note">Max size 3 MB</div>
                {imageFiles.length ? (
                  <div className="upload-note">{imageFiles.length} image(s) selected</div>
                ) : null}
              </label>
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
                    {options("attributes", row.variant)}
                  </select>
                  <select
                    value={row.value}
                    onChange={(event) =>
                      handleVariantChange(index, "value", event.target.value)
                    }
                  >
                    <option value="">Value</option>
                    {row.value && !(attributeValues[row.variant] ?? []).some(option => option.id === row.value) ? <option value={row.value}>Current value</option> : null}
                    {(attributeValues[row.variant] ?? []).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
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
            <input className="tags-select" value={form.tags} onChange={handleChange} name="tags" placeholder="Tags, separated by commas" />
            <div className="tag-list">
              {form.tags
                ? form.tags
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span className="tag-pill" key={tag}>
                        {tag}
                        <button type="button" aria-label={`Remove ${tag}`} onClick={() => setForm(prev => ({ ...prev, tags: prev.tags.split(",").map(value => value.trim()).filter(value => value !== tag).join(", ") }))}>
                          {"\u00d7"}
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
