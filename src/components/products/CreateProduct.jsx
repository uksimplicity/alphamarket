"use client";

import { useEffect, useMemo, useState } from "react";
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
  discountDuration: "",
};

function isUuid(value) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text
  );
}

export default function CreateProduct({ mode = "seller" }) {
  const [form, setForm] = useState(initialForm);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [variants, setVariants] = useState([{ variant: "", value: "" }]);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

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

    async function requestJson(url) {
      const auth = getAuth();
      const token = auth?.access_token;
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return response.json();
    }

    async function fetchOptions(candidates) {
      let lastError = null;
      for (const url of candidates) {
        try {
          const payload = await requestJson(url);
          const rows = walkRecords(payload, []);
          const mapped = rows
            .map((row) => ({
              id: String(row.id ?? row.uuid ?? "").trim(),
              name: String(row.name ?? row.title ?? "").trim(),
            }))
            .filter((row) => row.id && row.name);
          if (mapped.length > 0) return mapped;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) throw lastError;
      return [];
    }

    async function loadCatalog() {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const [categories, productTypes] = await Promise.all([
          fetchOptions([
            "/api/admin/categories?limit=200&offset=0",
            "/api/auth/admin/categories?limit=200&offset=0",
            "/api/admin/categories",
            "/api/auth/admin/categories",
          ]),
          fetchOptions([
            "/api/admin/product-types?limit=200&offset=0",
            "/api/auth/admin/product-types?limit=200&offset=0",
            "/api/admin/product-types",
            "/api/auth/admin/product-types",
          ]),
        ]);
        if (!isMounted) return;
        setCategoryOptions(categories);
        setTypeOptions(productTypes);
      } catch (error) {
        if (!isMounted) return;
        setCatalogError(error instanceof Error ? error.message : "Failed to load catalog options.");
      } finally {
        if (isMounted) setCatalogLoading(false);
      }
    }

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

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
        "Sorry you can not submit your product until your Vendor account is activated, Please contact Alpha Marketplace Administrator"
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
    if (!form.category.trim()) {
      setError("Category is required.");
      return;
    }
    if (!isUuid(form.category.trim())) {
      setError("Category must be a valid category ID (UUID).");
      return;
    }
    if (!form.type.trim()) {
      setError("Product type is required.");
      return;
    }
    if (!isUuid(form.type.trim())) {
      setError("Product type must be a valid product type ID (UUID).");
      return;
    }
    if (form.basePrice === "") {
      setError("Base price is required.");
      return;
    }
    async function uploadFile(file, folder) {
      if (!file) return "";
      const fd = new FormData();
      fd.append("file", file);
      if (folder) {
        fd.append("folder", folder);
      }
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
    const normalizedSlug =
      form.slug.trim() ||
      form.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

    const payload = {
      basePrice: Number(form.basePrice) || 0,
      categoryId: form.category,
      name: form.name.trim(),
      productTypeId: form.type,
      sellerId,
      slug: normalizedSlug,
      media: {
        cover: "",
        images: [],
        video: "",
      },
    };

    if (form.address.trim()) payload.address = form.address.trim();
    if (form.location.trim()) payload.location = form.location.trim();
    if (form.shortDescription.trim()) {
      payload.shortDescription = form.shortDescription.trim();
    }
    if (form.brand.trim() && isUuid(form.brand.trim())) {
      payload.brandId = form.brand.trim();
    }
    if (form.stock !== "") payload.stock = Number(form.stock) || 0;
    if (form.tags.trim()) payload.tags = [form.tags.trim()];

    const attributeRows = variants
      .filter(
        (row) => isUuid(row.variant?.trim?.() ?? "") && isUuid(row.value?.trim?.() ?? "")
      )
      .map((row) => ({
        attribute_id: row.variant.trim(),
        attribute_value_id: row.value.trim(),
      }));
    if (attributeRows.length > 0) payload.attributes = attributeRows;

    const hasDiscountData =
      discountEnabled &&
      form.discountTitle.trim() &&
      form.discountDuration.trim() &&
      form.discountPrice !== "";
    if (hasDiscountData) {
      payload.discounts = [
        {
          active: true,
          title: form.discountTitle.trim(),
          price: Number(form.discountPrice) || 0,
          startDate: form.discountDuration.trim(),
          endDate: form.discountDuration.trim(),
        },
      ];
    }

    try {
      setLoading(true);
      const coverUrl = await uploadFile(coverFile, "products");
      const imageUrls = imageFiles.length
        ? await Promise.all(
            imageFiles.map((file) => uploadFile(file, "products"))
          )
        : [];
      const videoUrl = await uploadFile(videoFile, "products");

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
        const textMessage = String(message);
        if (textMessage.toLowerCase().includes("not found")) {
          setError(
            "Sorry you can not submit your product until your Vendor account is activated, Please contact Alpha Marketplace Administrator"
          );
          return;
        }
        setError(textMessage);
        return;
      }

      setSuccess("Product created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create product failed.");
    } finally {
      setLoading(false);
    }
  };

  const variantRows = useMemo(() => variants, [variants]);
  const hasCategoryOptions = categoryOptions.length > 0;
  const hasTypeOptions = typeOptions.length > 0;

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
                <label>Brand</label>
                <select name="brand" value={form.brand} onChange={handleChange}>
                  <option value="">Select</option>
                  <option value="brand-a">Brand A</option>
                  <option value="brand-b">Brand B</option>
                </select>
              </div>
              <div className="field">
                <label>Base Price</label>
                <input
                  type="number"
                  name="basePrice"
                  value={form.basePrice}
                  onChange={handleChange}
                />
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
            {catalogError ? <div className="form-error">{catalogError}</div> : null}
            <div className="field full">
              <label>Short Description</label>
              <textarea
                name="shortDescription"
                rows={3}
                value={form.shortDescription}
                onChange={handleChange}
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
      <span className="upload-icon">↑</span>
      <div className="upload-title">Upload Cover photo</div>
      <div className="upload-note">Allowed *.jpeg, *.jpg, *.png</div>
      <div className="upload-note">Max size 3 MB</div>
      {coverFile ? (
        <div className="upload-filename">{coverFile.name}</div>
      ) : null}
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
      <span className="upload-icon">↑</span>
      <div className="upload-title">Upload Product photo</div>
      <div className="upload-note">Allowed *.jpeg, *.jpg, *.png</div>
      <div className="upload-note">Max size 3 MB</div>
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
      <span className="upload-icon">↑</span>
      <div className="upload-title">Upload Video (optional)</div>
      <div className="upload-note">Allowed *.mp4, *.mov, *.avi</div>
      <div className="upload-note">Max size 3 MB</div>
      {videoFile ? (
        <div className="upload-filename">{videoFile.name}</div>
      ) : null}
    </label>
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

          {error ? <div className="form-error">{error}</div> : null}
          {success ? <div className="form-success">{success}</div> : null}
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={() => router.back()}>
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

