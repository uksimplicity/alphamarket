"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "@/components/products/CreateProduct.css";
import { getAuth } from "@/components/auth/authStorage";

const initialForm = {
  name: "",
  slug: "",
  sellerId: "",
  category: "",
  type: "",
  brand: "",
  shortDescription: "",
  basePrice: "",
  stock: "",
  address: "",
  location: "",
  latitude: "",
  longitude: "",
  tags: "",
  discountTitle: "",
  discountPrice: "",
  discountStartDate: "",
  discountEndDate: "",
};

function isUuid(value) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text
  );
}

function toSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function walkRecords(payload, target = []) {
  if (Array.isArray(payload)) {
    payload.forEach((item) => walkRecords(item, target));
    return target;
  }
  const record = asRecord(payload);
  if (!record) return target;

  const hasId = typeof record.id === "string" || typeof record.uuid === "string";
  const hasName = typeof record.name === "string" || typeof record.title === "string";
  if (hasId && hasName) target.push(record);

  Object.values(record).forEach((value) => walkRecords(value, target));
  return target;
}

function parseOptions(payload) {
  return walkRecords(payload, [])
    .map((row) => ({
      id: String(row.id ?? row.uuid ?? "").trim(),
      name: String(row.name ?? row.title ?? "").trim(),
    }))
    .filter((row) => row.id && row.name);
}

function validateFileSize(file, label, maxMb = 3) {
  if (!file) return "";
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return `${label} is too large. Max size is ${maxMb}MB.`;
  }
  return "";
}

const LOCAL_CREATED_PRODUCTS_KEY = "alpha.createdProducts";

function persistCreatedProduct(product) {
  if (typeof window === "undefined" || !product) return;
  try {
    const existingRaw = localStorage.getItem(LOCAL_CREATED_PRODUCTS_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const list = Array.isArray(existing) ? existing : [];
    const normalized = {
      ...product,
      id: String(product.id ?? product.product_id ?? product.uuid ?? crypto.randomUUID()),
    };
    const merged = [
      normalized,
      ...list.filter((item) => String(item?.id) !== String(normalized.id)),
    ].slice(0, 200);
    localStorage.setItem(LOCAL_CREATED_PRODUCTS_KEY, JSON.stringify(merged));
  } catch {
    // ignore local storage errors
  }
}

export default function CreateProduct({ mode = "seller" }) {
  const [form, setForm] = useState(initialForm);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [variants, setVariants] = useState([{ attributeId: "", attributeValueId: "" }]);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [submitIntent, setSubmitIntent] = useState("publish");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    async function requestCatalog(resource) {
      const auth = getAuth();
      const token = auth?.access_token;
      const response = await fetch(
        `/api/seller/catalog?resource=${encodeURIComponent(resource)}&limit=200&offset=0`,
        {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!response.ok) throw new Error(`Could not load ${resource} (${response.status}).`);
      return response.json();
    }

    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const [categories, productTypes, brands, tags] = await Promise.all([
          requestCatalog("categories"),
          requestCatalog("product-types"),
          requestCatalog("brands"),
          requestCatalog("tags"),
        ]);
        if (!isMounted) return;

        setCategoryOptions(parseOptions(categories));
        setTypeOptions(parseOptions(productTypes));
        setBrandOptions(parseOptions(brands));
        setTagOptions(parseOptions(tags));
      } catch (loadError) {
        if (!isMounted) return;
        setCatalogError(
          loadError instanceof Error ? loadError.message : "Failed to load seller catalog options."
        );
      } finally {
        if (isMounted) setCatalogLoading(false);
      }
    }

    void loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setForm((prev) => {
      if (prev.slug.trim()) return prev;
      return { ...prev, slug: toSlug(prev.name) };
    });
  }, [form.name]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleVariantChange = (index, field, value) => {
    setVariants((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const addVariant = () => {
    setVariants((prev) => [...prev, { attributeId: "", attributeValueId: "" }]);
  };

  const removeVariant = (index) => {
    setVariants((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const removeDiscount = () => {
    setForm((prev) => ({
      ...prev,
      discountTitle: "",
      discountPrice: "",
      discountStartDate: "",
      discountEndDate: "",
    }));
    setDiscountEnabled(false);
  };

  async function uploadFile(file, folder, token) {
    if (!file) return "";
    const fd = new FormData();
    fd.append("file", file);
    if (folder) fd.append("folder", folder);

    const response = await fetch("/api/upload/file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: fd,
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
          : `File upload failed (${response.status}).`;
      throw new Error(String(message));
    }

    return (
      data?.url ||
      data?.file_url ||
      data?.path ||
      data?.data?.url ||
      data?.data?.file_url ||
      data?.data?.path ||
      ""
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const auth = getAuth();
    const token = auth?.access_token;
    const userStatus = auth?.user?.status;

    if (!token) {
      setError("You must be logged in to create a product.");
      return;
    }

    if (mode === "seller" && userStatus && userStatus !== "active") {
      setError(
        "You can not submit product until your vendor account is activated. Please contact admin."
      );
      return;
    }

    const sellerId = mode === "admin" ? form.sellerId.trim() : auth?.user?.id;
    if (!sellerId) {
      setError("Seller ID is missing. Please log in again.");
      return;
    }

    if (!form.name.trim()) {
      setError("Product name is required.");
      return;
    }
    if (!form.category.trim() || !isUuid(form.category.trim())) {
      setError("Category must be selected with a valid UUID.");
      return;
    }
    if (!form.type.trim() || !isUuid(form.type.trim())) {
      setError("Product type must be selected with a valid UUID.");
      return;
    }
    if (!form.basePrice.trim() || Number(form.basePrice) <= 0) {
      setError("Base price must be greater than 0.");
      return;
    }
    if (form.brand.trim() && !isUuid(form.brand.trim())) {
      setError("Brand must be a valid UUID.");
      return;
    }

    for (const [index, row] of variants.entries()) {
      const hasAny = row.attributeId.trim() || row.attributeValueId.trim();
      if (!hasAny) continue;
      if (!isUuid(row.attributeId.trim()) || !isUuid(row.attributeValueId.trim())) {
        setError(`Variant row ${index + 1} must contain valid UUIDs.`);
        return;
      }
    }

    if (discountEnabled) {
      if (!form.discountTitle.trim()) {
        setError("Discount title is required when discount is enabled.");
        return;
      }
      if (!form.discountStartDate || !form.discountEndDate) {
        setError("Discount start and end dates are required.");
        return;
      }
      if (!form.discountPrice.trim() || Number(form.discountPrice) <= 0) {
        setError("Discount price must be greater than 0.");
        return;
      }
    }

    const coverError = validateFileSize(coverFile, "Cover image");
    if (coverError) {
      setError(coverError);
      return;
    }
    for (const file of imageFiles) {
      const imageError = validateFileSize(file, `Image "${file.name}"`);
      if (imageError) {
        setError(imageError);
        return;
      }
    }
    const videoError = validateFileSize(videoFile, "Video");
    if (videoError) {
      setError(videoError);
      return;
    }

    const normalizedSlug = form.slug.trim() || toSlug(form.name);
    const tagList = form.tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      basePrice: Number(form.basePrice) || 0,
      categoryId: form.category.trim(),
      name: form.name.trim(),
      productTypeId: form.type.trim(),
      sellerId,
      slug: normalizedSlug,
      status: submitIntent === "draft" ? "draft" : "publish",
      isPublished: submitIntent !== "draft",
      media: {
        cover: "",
        images: [],
        video: "",
      },
    };

    if (form.address.trim()) payload.address = form.address.trim();
    if (form.location.trim()) payload.location = form.location.trim();
    if (form.shortDescription.trim()) payload.shortDescription = form.shortDescription.trim();
    if (form.brand.trim()) payload.brandId = form.brand.trim();
    if (form.stock !== "") payload.stock = Number(form.stock) || 0;
    if (tagList.length > 0) payload.tags = tagList;

    if (form.latitude.trim()) payload.latitude = Number(form.latitude);
    if (form.longitude.trim()) payload.longitude = Number(form.longitude);

    const attributeRows = variants
      .filter((row) => isUuid(row.attributeId.trim()) && isUuid(row.attributeValueId.trim()))
      .map((row) => ({
        attribute_id: row.attributeId.trim(),
        attribute_value_id: row.attributeValueId.trim(),
      }));
    if (attributeRows.length > 0) payload.attributes = attributeRows;

    if (discountEnabled) {
      payload.discounts = [
        {
          active: true,
          title: form.discountTitle.trim(),
          price: Number(form.discountPrice) || 0,
          startDate: form.discountStartDate,
          endDate: form.discountEndDate,
        },
      ];
    }

    try {
      setLoading(true);

      const coverUrl = await uploadFile(coverFile, "products", token);
      const imageUrls = imageFiles.length
        ? await Promise.all(imageFiles.map((file) => uploadFile(file, "products", token)))
        : [];
      const videoUrl = await uploadFile(videoFile, "products", token);

      payload.media.cover = coverUrl;
      payload.media.images = imageUrls.filter(Boolean);
      payload.media.video = videoUrl;

      const createEndpoint =
        mode === "admin" ? "/api/auth/admin/products" : "/api/seller/products";

      const response = await fetch(createEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
          data && typeof data === "object"
            ? data.error || data.message || data.details
            : `Create product failed (${response.status}).`;
        setError(String(message));
        return;
      }

      const createdRecord =
        data && typeof data === "object"
          ? (data.data ?? data.product ?? data.item ?? data)
          : null;
      persistCreatedProduct(
        createdRecord && typeof createdRecord === "object"
          ? createdRecord
          : {
              ...payload,
              id: crypto.randomUUID(),
            }
      );

      setSuccess(
        submitIntent === "draft"
          ? "Draft saved successfully."
          : "Product published successfully."
      );
      router.push(mode === "admin" ? "/admin/products" : "/vendor/products");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Create product failed.");
    } finally {
      setLoading(false);
    }
  };

  const hasCategoryOptions = categoryOptions.length > 0;
  const hasTypeOptions = typeOptions.length > 0;
  const hasBrandOptions = brandOptions.length > 0;

  return (
    <div className="create-page">
      <div className="create-card">
        <div className="create-header">
          <div className="create-title">
            <button type="button" className="back-btn" aria-label="Back" onClick={() => router.back()}>
              <span aria-hidden="true">&larr;</span>
            </button>
            <h1>Create Product</h1>
          </div>
          <div className="badge-blue">{loading ? "Submitting..." : "Ready"}</div>
        </div>

        <form onSubmit={handleSubmit} className="create-form">
          <section className="form-section">
            <div className="section-title">Basic Information</div>
            <div className="form-grid">
              <div className="field">
                <label>Product Name</label>
                <input
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="e.g. Wireless Keyboard"
                />
              </div>
              <div className="field">
                <label>Slug</label>
                <input
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  placeholder="auto-generated from product name"
                />
              </div>
              {mode === "admin" ? (
                <div className="field">
                  <label>Seller ID</label>
                  <input
                    name="sellerId"
                    value={form.sellerId}
                    onChange={handleChange}
                    placeholder="Seller UUID"
                  />
                </div>
              ) : null}
              <div className="field">
                <label>Category</label>
                <select name="category" value={form.category} onChange={handleChange}>
                  <option value="">
                    {catalogLoading ? "Loading categories..." : "Select Category"}
                  </option>
                  {categoryOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {!catalogLoading && !hasCategoryOptions ? (
                  <input
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="Paste Category UUID"
                    className="mt-2"
                  />
                ) : null}
              </div>
              <div className="field">
                <label>Product Type</label>
                <select name="type" value={form.type} onChange={handleChange}>
                  <option value="">
                    {catalogLoading ? "Loading product types..." : "Select Product Type"}
                  </option>
                  {typeOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {!catalogLoading && !hasTypeOptions ? (
                  <input
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    placeholder="Paste Product Type UUID"
                    className="mt-2"
                  />
                ) : null}
              </div>
              <div className="field">
                <label>Brand (optional)</label>
                <select name="brand" value={form.brand} onChange={handleChange}>
                  <option value="">
                    {catalogLoading ? "Loading brands..." : "Select Brand"}
                  </option>
                  {brandOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {!catalogLoading && !hasBrandOptions ? (
                  <input
                    name="brand"
                    value={form.brand}
                    onChange={handleChange}
                    placeholder="Paste Brand UUID (optional)"
                    className="mt-2"
                  />
                ) : null}
              </div>
              <div className="field">
                <label>Base Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="basePrice"
                  value={form.basePrice}
                  onChange={handleChange}
                  placeholder="0.00"
                />
              </div>
              <div className="field">
                <label>Stock</label>
                <input
                  type="number"
                  min="0"
                  name="stock"
                  value={form.stock}
                  onChange={handleChange}
                  placeholder="0"
                />
              </div>
            </div>
            {catalogError ? <div className="form-error">{catalogError}</div> : null}
            <div className="field full">
              <label>Short Description</label>
              <textarea
                name="shortDescription"
                rows={3}
                value={form.shortDescription}
                onChange={handleChange}
                placeholder="A short summary buyers will see first."
              />
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Address</label>
                <input name="address" value={form.address} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Location</label>
                <input name="location" value={form.location} onChange={handleChange} />
              </div>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Latitude (optional)</label>
                <input name="latitude" value={form.latitude} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Longitude (optional)</label>
                <input name="longitude" value={form.longitude} onChange={handleChange} />
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">Media</div>
            <div className="media-grid">
              <label className="upload-card">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                />
                <span className="upload-icon">&#8593;</span>
                <div className="upload-title">Upload Cover Photo</div>
                <div className="upload-note">Allowed *.jpeg, *.jpg, *.png</div>
                <div className="upload-note">Max size 3 MB</div>
                {coverFile ? <div className="upload-filename">{coverFile.name}</div> : null}
              </label>
              <label className="upload-card">
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png"
                  multiple
                  onChange={(event) =>
                    setImageFiles(event.target.files ? Array.from(event.target.files) : [])
                  }
                />
                <span className="upload-icon">&#8593;</span>
                <div className="upload-title">Upload Product Photos</div>
                <div className="upload-note">Allowed *.jpeg, *.jpg, *.png</div>
                <div className="upload-note">Max size 3 MB each</div>
                {imageFiles.length > 0 ? (
                  <div className="upload-filename">{imageFiles.length} file(s)</div>
                ) : null}
              </label>
              <label className="upload-card">
                <input
                  type="file"
                  accept=".mp4,.mov,.avi"
                  onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
                />
                <span className="upload-icon">&#8593;</span>
                <div className="upload-title">Upload Video (optional)</div>
                <div className="upload-note">Allowed *.mp4, *.mov, *.avi</div>
                <div className="upload-note">Max size 3 MB</div>
                {videoFile ? <div className="upload-filename">{videoFile.name}</div> : null}
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="section-row">
              <div className="section-title">Variants (optional)</div>
              <button type="button" className="btn-outline" onClick={addVariant}>
                Add Variant Row
              </button>
            </div>
            <div className="variant-grid">
              {variants.map((row, index) => (
                <div className="variant-row" key={`variant-${index}`}>
                  <input
                    value={row.attributeId}
                    onChange={(event) =>
                      handleVariantChange(index, "attributeId", event.target.value)
                    }
                    placeholder="Attribute ID (UUID)"
                  />
                  <input
                    value={row.attributeValueId}
                    onChange={(event) =>
                      handleVariantChange(index, "attributeValueId", event.target.value)
                    }
                    placeholder="Attribute Value ID (UUID)"
                  />
                  <button type="button" className="btn-outline" onClick={() => removeVariant(index)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">Tags (optional)</div>
            <div className="field">
              <input
                name="tags"
                value={form.tags}
                onChange={handleChange}
                list="seller-tag-options"
                placeholder="Comma-separated tags e.g. featured, new, sale"
              />
              <datalist id="seller-tag-options">
                {tagOptions.map((item) => (
                  <option key={item.id} value={item.name} />
                ))}
              </datalist>
            </div>
          </section>

          <section className="form-section">
            <div className="section-row">
              <div className="section-title">Discount (optional)</div>
              <button type="button" className="btn-outline" onClick={removeDiscount}>
                Clear Discount
              </button>
            </div>
            <div className="discount-toggle">
              <span>Enable Discount</span>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={discountEnabled}
                  onChange={(event) => setDiscountEnabled(event.target.checked)}
                />
                <span className="slider" />
              </label>
            </div>
            {discountEnabled ? (
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
                    min="0"
                    step="0.01"
                    name="discountPrice"
                    value={form.discountPrice}
                    onChange={handleChange}
                  />
                </div>
                <div className="field">
                  <label>Start Date</label>
                  <input
                    type="date"
                    name="discountStartDate"
                    value={form.discountStartDate}
                    onChange={handleChange}
                  />
                </div>
                <div className="field">
                  <label>End Date</label>
                  <input
                    type="date"
                    name="discountEndDate"
                    value={form.discountEndDate}
                    onChange={handleChange}
                  />
                </div>
              </div>
            ) : null}
          </section>

          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={() => router.back()}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-cancel"
              disabled={loading}
              onClick={() => setSubmitIntent("draft")}
            >
              {loading && submitIntent === "draft" ? "Saving draft..." : "Save Draft"}
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={loading}
              onClick={() => setSubmitIntent("publish")}
            >
              {loading && submitIntent === "publish" ? "Publishing..." : "Publish Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
