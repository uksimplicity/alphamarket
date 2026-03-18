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

function getValueCaseInsensitive(record, keys) {
  if (!record) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }
  const lowered = new Map(
    Object.entries(record).map(([key, value]) => [key.toLowerCase(), value])
  );
  for (const key of keys) {
    const value = lowered.get(String(key).toLowerCase());
    if (value !== undefined) return value;
  }
  return undefined;
}

function toText(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
}

function walkRecords(payload, target = []) {
  if (Array.isArray(payload)) {
    payload.forEach((item) => walkRecords(item, target));
    return target;
  }
  const record = asRecord(payload);
  if (!record) return target;

  const idCandidate = getValueCaseInsensitive(record, [
    "id",
    "uuid",
    "category_id",
    "categoryId",
    "product_type_id",
    "type_id",
    "productTypeId",
    "typeId",
  ]);
  const nameCandidate = getValueCaseInsensitive(record, [
    "name",
    "title",
    "category",
    "type",
    "productType",
    "product_type_name",
    "productTypeName",
    "category_name",
    "categoryName",
    "type_name",
    "product_type",
    "label",
  ]);
  const hasId = typeof idCandidate === "string" || typeof idCandidate === "number";
  const hasName = typeof nameCandidate === "string" || typeof nameCandidate === "number";
  if (hasId && hasName) target.push(record);

  Object.values(record).forEach((value) => walkRecords(value, target));
  return target;
}

function parseOptions(payload) {
  return walkRecords(payload, [])
    .map((row) => {
      const id = toText(
        getValueCaseInsensitive(row, [
          "id",
          "uuid",
          "category_id",
          "categoryId",
          "product_type_id",
          "type_id",
          "productTypeId",
          "typeId",
        ])
      );
      const name = toText(
        getValueCaseInsensitive(row, [
          "name",
          "title",
          "category",
          "type",
          "productType",
          "product_type_name",
          "productTypeName",
          "category_name",
          "categoryName",
          "type_name",
          "product_type",
          "label",
        ])
      );
      const categoryId = toText(getValueCaseInsensitive(row, ["category_id", "categoryId", "categoryID"]));
      const categoryName = toText(
        getValueCaseInsensitive(row, ["category_name", "categoryName", "category"])
      );
      return { id, name, categoryId, categoryName };
    })
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

function buildAuthorizationHeader(token) {
  const trimmed = String(token ?? "").trim();
  if (!trimmed) return "";
  return /^bearer\s+/i.test(trimmed) ? trimmed : `Bearer ${trimmed}`;
}

const LOCAL_CREATED_PRODUCTS_KEY = "alpha.createdProducts";
const LOCAL_PRODUCTS_UPDATED_EVENT = "alpha-products-updated";
const ADMIN_CATEGORIES_CACHE_KEY = "alpha.admin.categories";
const ADMIN_PRODUCT_TYPES_CACHE_KEY = "alpha.admin.product-types";
const MAX_PRODUCT_PRICE = 1000000000;
const MAX_PRODUCT_STOCK = 1000000;
const MAX_DISCOUNT_PRICE = 1000000000;

function parsePositivePrice(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

function parseNonNegativeInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (!Number.isInteger(numeric)) return null;
  return numeric;
}

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
    window.dispatchEvent(new Event(LOCAL_PRODUCTS_UPDATED_EVENT));
  } catch {
    // ignore local storage errors
  }
}

function readCachedAdminCategories() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ADMIN_CATEGORIES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const id = String(item?.id ?? "").trim();
        const name = String(item?.name ?? "").trim();
        return { id, name };
      })
      .filter((item) => item.id && item.name);
  } catch {
    return [];
  }
}

function readCachedAdminProductTypes() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ADMIN_PRODUCT_TYPES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const id = String(item?.id ?? "").trim();
        const name = String(item?.name ?? "").trim();
        const categoryId = String(item?.categoryId ?? "").trim();
        const categoryName = String(item?.categoryName ?? "").trim();
        return { id, name, categoryId, categoryName };
      })
      .filter((item) => item.id && item.name);
  } catch {
    return [];
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
      const authorization = buildAuthorizationHeader(token);
      const response = await fetch(
        `/api/seller/catalog?resource=${encodeURIComponent(resource)}&limit=200&offset=0`,
        {
          headers: {
            Accept: "application/json",
            ...(authorization ? { Authorization: authorization } : {}),
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
        const [categoriesResult, productTypesResult, brandsResult, tagsResult] =
          await Promise.allSettled([
          requestCatalog("categories"),
          requestCatalog("product-types"),
          requestCatalog("brands"),
          requestCatalog("tags"),
        ]);
        if (!isMounted) return;

        const categories =
          categoriesResult.status === "fulfilled" ? categoriesResult.value : null;
        const productTypes =
          productTypesResult.status === "fulfilled" ? productTypesResult.value : null;
        const brands = brandsResult.status === "fulfilled" ? brandsResult.value : null;
        const tags = tagsResult.status === "fulfilled" ? tagsResult.value : null;

        const apiCategories = parseOptions(categories);
        const cachedCategories = readCachedAdminCategories();
        setCategoryOptions(apiCategories.length > 0 ? apiCategories : cachedCategories);
        const apiProductTypes = parseOptions(productTypes);
        const cachedProductTypes = readCachedAdminProductTypes();
        setTypeOptions(apiProductTypes.length > 0 ? apiProductTypes : cachedProductTypes);
        setBrandOptions(parseOptions(brands));
        setTagOptions(parseOptions(tags));

        const failedMessages = [
          categoriesResult,
          productTypesResult,
          brandsResult,
          tagsResult,
        ]
          .filter((item) => item.status === "rejected")
          .map((item) =>
            item.reason instanceof Error
              ? item.reason.message
              : "Catalog endpoint failed."
          );

        const categoriesWarning =
          categories && typeof categories === "object" && "warning" in categories
            ? String(categories.warning ?? "")
            : "";
        const typesWarning =
          productTypes && typeof productTypes === "object" && "warning" in productTypes
            ? String(productTypes.warning ?? "")
            : "";
        if (
          !apiCategories.length &&
          !apiProductTypes.length &&
          (categoriesWarning || typesWarning || failedMessages.length)
        ) {
          setCatalogError(
            [categoriesWarning, typesWarning, ...failedMessages]
              .filter(Boolean)
              .join(" ")
          );
        }
      } catch (loadError) {
        if (!isMounted) return;
        setCategoryOptions(readCachedAdminCategories());
        setTypeOptions(readCachedAdminProductTypes());
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
        Authorization: token,
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
    const authorization = buildAuthorizationHeader(token);
    const userStatus = auth?.user?.status;

    if (!authorization) {
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
    if (!form.category.trim()) {
      setError("Please select a category.");
      return;
    }
    if (!form.type.trim()) {
      setError("Please select a product type.");
      return;
    }
    const basePriceNumber = parsePositivePrice(form.basePrice);
    if (!form.basePrice.trim() || basePriceNumber === null || basePriceNumber <= 0) {
      setError("Base price must be greater than 0.");
      return;
    }
    if (basePriceNumber > MAX_PRODUCT_PRICE) {
      setError(`Base price is too large. Maximum allowed is ${MAX_PRODUCT_PRICE.toLocaleString()}.`);
      return;
    }

    let stockNumber = null;
    if (form.stock !== "") {
      stockNumber = parseNonNegativeInteger(form.stock);
      if (stockNumber === null) {
        setError("Stock must be a whole number.");
        return;
      }
    }

    if (stockNumber !== null && stockNumber > MAX_PRODUCT_STOCK) {
      setError(`Stock is too large. Maximum allowed is ${MAX_PRODUCT_STOCK.toLocaleString()}.`);
      return;
    }
    if (stockNumber !== null && stockNumber < 0) {
      setError("Stock cannot be negative.");
      return;
    }
    if (!form.shortDescription.trim()) {
      setError("Product description is required.");
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
      const discountPriceNumber = parsePositivePrice(form.discountPrice);
      if (!form.discountPrice.trim() || discountPriceNumber === null || discountPriceNumber <= 0) {
        setError("Discount price must be greater than 0.");
        return;
      }
      if (discountPriceNumber > MAX_DISCOUNT_PRICE) {
        setError(`Discount price is too large. Maximum allowed is ${MAX_DISCOUNT_PRICE.toLocaleString()}.`);
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
      basePrice: basePriceNumber,
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
    if (stockNumber !== null) payload.stock = stockNumber;
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
          price: Number(form.discountPrice),
          startDate: form.discountStartDate,
          endDate: form.discountEndDate,
        },
      ];
    }

    try {
      setLoading(true);

      const coverUrl = await uploadFile(coverFile, "products", authorization);
      const imageUrls = imageFiles.length
        ? await Promise.all(imageFiles.map((file) => uploadFile(file, "products", authorization)))
        : [];
      const videoUrl = await uploadFile(videoFile, "products", authorization);

      payload.media.cover = coverUrl;
      payload.media.images = imageUrls.filter(Boolean);
      payload.media.video = videoUrl;

      const createEndpoint =
        mode === "admin" ? "/api/admin/products" : "/api/seller/products";

      const response = await fetch(createEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authorization,
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
                  <div className="mt-2 text-xs text-slate-500">
                    No categories available yet. Ask admin to create categories first.
                  </div>
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
                  <div className="mt-2 text-xs text-slate-500">
                    No product types available yet. Ask admin to create product types first.
                  </div>
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
