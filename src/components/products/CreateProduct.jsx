"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "@/components/products/CreateProduct.css";
import { getAuth } from "@/components/auth/authStorage";

const initialForm = {
  name: "",
  category: "",
  type: "",
  brand: "",
  shortDescription: "",
  basePrice: "",
  stock: "",
  location: "",
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

function parseProductTypeOptions(payload) {
  return walkRecords(payload, [])
    .map((row) => {
      const id = toText(
        getValueCaseInsensitive(row, [
          "id",
          "uuid",
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
          "type",
          "productType",
          "product_type_name",
          "productTypeName",
          "type_name",
          "product_type",
          "label",
        ])
      );
      const categoryRecord = asRecord(
        getValueCaseInsensitive(row, ["category", "parent_category", "parentCategory"])
      );
      const categoryId =
        toText(getValueCaseInsensitive(row, ["category_id", "categoryId", "categoryID"])) ||
        toText(getValueCaseInsensitive(categoryRecord, ["id", "uuid", "category_id", "categoryId"]));
      const categoryName =
        toText(getValueCaseInsensitive(row, ["category_name", "categoryName"])) ||
        toText(getValueCaseInsensitive(categoryRecord, ["name", "title", "category_name", "categoryName"]));

      return { id, name, categoryId, categoryName };
    })
    .filter((row) => row.id && row.name)
    .filter((row, index, arr) => {
      const key = `${row.id}:${row.name.toLowerCase()}:${row.categoryId || ""}`;
      return (
        arr.findIndex(
          (item) =>
            `${item.id}:${item.name.toLowerCase()}:${item.categoryId || ""}` === key
        ) === index
      );
    });
}

function parseAdminCategoryOptions(payload) {
  const record = asRecord(payload);
  const candidates = Array.isArray(record?.categories)
    ? record.categories
    : Array.isArray(record?.data)
      ? record.data
      : [];
  const rows = Array.isArray(candidates) ? candidates : [];
  const mapped = rows
    .map((item) => asRecord(item))
    .filter(Boolean)
    .map((row) => ({
      id: toText(getValueCaseInsensitive(row, ["id", "uuid", "category_id", "categoryId"])),
      name: toText(
        getValueCaseInsensitive(row, ["name", "title", "category_name", "categoryName"])
      ),
    }))
    .filter((item) => item.id && item.name);

  const seen = new Set();
  return mapped.filter((item) => {
    const key = `${item.id}:${item.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseCatalogCategoryOptions(payload) {
  const record = asRecord(payload);
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(record?.data)
      ? record.data
      : Array.isArray(record?.items)
        ? record.items
        : Array.isArray(record?.categories)
          ? record.categories
          : [];
  const rows = Array.isArray(candidates) ? candidates : [];
  const mapped = rows
    .map((item) => asRecord(item))
    .filter(Boolean)
    .map((row) => ({
      id: toText(getValueCaseInsensitive(row, ["id", "uuid", "category_id", "categoryId"])),
      name: toText(
        getValueCaseInsensitive(row, ["name", "title", "category_name", "categoryName"])
      ),
    }))
    .filter((item) => item.id && item.name);

  const seen = new Set();
  return mapped.filter((item) => {
    const key = `${item.id}:${item.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

const LOCAL_PRODUCTS_UPDATED_EVENT = "alpha-products-updated";
const ADMIN_CATEGORIES_CACHE_KEY = "alpha.admin.categories";
const ADMIN_PRODUCT_TYPES_CACHE_KEY = "alpha.admin.product-types";
const MAX_PRODUCT_PRICE = 1000000000;
const MAX_PRODUCT_STOCK = 1000000;
const MAX_DISCOUNT_PRICE = 1000000000;
const CATALOG_POLL_INTERVAL_MS = 5000;

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

function findFirstValidBrandId(options) {
  if (!Array.isArray(options)) return "";
  for (const option of options) {
    const id = String(option?.id ?? "").trim();
    if (isUuid(id)) return id;
  }
  return "";
}

function readFirstFiniteNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return null;
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
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
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

    async function requestAdminCategories() {
      const auth = getAuth();
      const token = auth?.access_token;
      const authorization = buildAuthorizationHeader(token);
      const response = await fetch("/api/admin/categories/raw", {
        headers: {
          Accept: "application/json",
          ...(authorization ? { Authorization: authorization } : {}),
        },
      });
      if (!response.ok) throw new Error(`Could not load admin categories (${response.status}).`);
      return response.json();
    }

    async function loadCatalog() {
      setCatalogLoading(true);
      setCategoryLoading(true);
      setCatalogError("");
      try {
        const cachedCategories = readCachedAdminCategories();
        const cachedProductTypes = readCachedAdminProductTypes();

        let categoriesWarning = "";
        let typesWarning = "";
        const failedMessages = [];
        let apiCategories = [];
        let apiProductTypes = [];

        let adminCategoriesPayload = null;
        try {
          adminCategoriesPayload = await requestAdminCategories();
          if (!isMounted) return;
          apiCategories = parseAdminCategoryOptions(adminCategoriesPayload);
        } catch (error) {
          failedMessages.push(
            error instanceof Error ? error.message : "Failed to load admin categories."
          );
        }

        if (apiCategories.length > 0) {
          setCategoryOptions(apiCategories);
        } else {
          try {
            const sellerCatalogCategories = await requestCatalog("categories");
            if (!isMounted) return;
            const sellerCatalogOptions = parseCatalogCategoryOptions(sellerCatalogCategories);
            if (sellerCatalogOptions.length > 0) {
              setCategoryOptions(sellerCatalogOptions);
              apiCategories = sellerCatalogOptions;
            } else if (cachedCategories.length > 0) {
              setCategoryOptions(cachedCategories);
            }
          } catch {
            if (cachedCategories.length > 0) {
              setCategoryOptions(cachedCategories);
            }
          }
        }

        categoriesWarning =
          adminCategoriesPayload &&
          typeof adminCategoriesPayload === "object" &&
          "warning" in adminCategoriesPayload
            ? String(adminCategoriesPayload.warning ?? "")
            : "";

        if (isMounted) setCategoryLoading(false);

        const [productTypesResult, brandsResult, tagsResult] = await Promise.allSettled([
          requestCatalog("product-types"),
          requestCatalog("brands"),
          requestCatalog("tags"),
        ]);
        if (!isMounted) return;

        const productTypes =
          productTypesResult.status === "fulfilled" ? productTypesResult.value : null;
        const brands = brandsResult.status === "fulfilled" ? brandsResult.value : null;
        const tags = tagsResult.status === "fulfilled" ? tagsResult.value : null;

        apiProductTypes = parseProductTypeOptions(productTypes);
        if (apiProductTypes.length > 0) {
          setTypeOptions(apiProductTypes);
        } else if (cachedProductTypes.length > 0) {
          setTypeOptions(cachedProductTypes);
        }
        setBrandOptions(parseOptions(brands));
        setTagOptions(parseOptions(tags));

        if (productTypesResult.status === "rejected") {
          failedMessages.push(
            productTypesResult.reason instanceof Error
              ? productTypesResult.reason.message
              : "Failed to load product types."
          );
        }
        if (brandsResult.status === "rejected") {
          failedMessages.push(
            brandsResult.reason instanceof Error
              ? brandsResult.reason.message
              : "Failed to load brands."
          );
        }
        if (tagsResult.status === "rejected") {
          failedMessages.push(
            tagsResult.reason instanceof Error
              ? tagsResult.reason.message
              : "Failed to load tags."
          );
        }

        typesWarning =
          productTypes && typeof productTypes === "object" && "warning" in productTypes
            ? String(productTypes.warning ?? "")
            : "";

        if (
          !apiCategories.length &&
          !apiProductTypes.length &&
          (categoriesWarning || typesWarning || failedMessages.length)
        ) {
          setCatalogError(
            [categoriesWarning, typesWarning, ...failedMessages].filter(Boolean).join(" ")
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
        if (isMounted) {
          setCatalogLoading(false);
          setCategoryLoading(false);
        }
      }
    }

    const pollId = window.setInterval(() => {
      if (isMounted) {
        void loadCatalog();
      }
    }, CATALOG_POLL_INTERVAL_MS);

    const handleFocus = () => {
      if (isMounted) {
        void loadCatalog();
      }
    };
    window.addEventListener("focus", handleFocus);

    void loadCatalog();
    return () => {
      isMounted = false;
      window.clearInterval(pollId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "category") {
        return { ...prev, category: value, type: "" };
      }
      return { ...prev, [name]: value };
    });
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

    const sellerId = auth?.user?.id;
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

    const normalizedSlug = toSlug(form.name);
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

    if (form.location.trim()) payload.location = form.location.trim();
    if (form.shortDescription.trim()) payload.shortDescription = form.shortDescription.trim();
    const selectedBrandId = form.brand.trim();
    const fallbackBrandId = findFirstValidBrandId(brandOptions);
    if (selectedBrandId && isUuid(selectedBrandId)) {
      payload.brandId = selectedBrandId;
    } else if (fallbackBrandId) {
      payload.brandId = fallbackBrandId;
    }
    if (stockNumber !== null) payload.stock = stockNumber;
    if (tagList.length > 0) payload.tags = tagList;
    const latitude = readFirstFiniteNumber(
      auth?.user?.latitude,
      auth?.user?.lat,
      auth?.user?.profile?.latitude,
      auth?.user?.profile?.lat
    );
    const longitude = readFirstFiniteNumber(
      auth?.user?.longitude,
      auth?.user?.lng,
      auth?.user?.profile?.longitude,
      auth?.user?.profile?.lng
    );
    if (latitude !== null) payload.latitude = latitude;
    if (longitude !== null) payload.longitude = longitude;

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

      async function createWithPayload(nextPayload) {
        const response = await fetch(createEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authorization,
          },
          body: JSON.stringify(nextPayload),
        });

        const text = await response.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }

        return { response, data };
      }

      let { response, data } = await createWithPayload(payload);

      if (!response.ok && payload.brandId) {
        const fkErrorText =
          data && typeof data === "object"
            ? String(data.error ?? data.message ?? data.details ?? "")
            : String(data ?? "");
        const isBrandFkViolation =
          fkErrorText.toLowerCase().includes("fk_products_brand") ||
          fkErrorText.toLowerCase().includes("violates foreign key constraint");

        if (isBrandFkViolation) {
          const fallbackBrandId = findFirstValidBrandId(brandOptions);
          if (fallbackBrandId && fallbackBrandId !== payload.brandId) {
            const retryWithFallbackBrand = { ...payload, brandId: fallbackBrandId };
            ({ response, data } = await createWithPayload(retryWithFallbackBrand));
            if (response.ok) {
              setForm((prev) => ({ ...prev, brand: fallbackBrandId }));
            }
          }
        }
      }

      if (!response.ok && payload.brandId) {
        const retryPayload = { ...payload };
        delete retryPayload.brandId;
        ({ response, data } = await createWithPayload(retryPayload));
        if (response.ok) {
          setForm((prev) => ({ ...prev, brand: "" }));
        }
      }

      if (!response.ok) {
        const message =
          data && typeof data === "object"
            ? data.error || data.message || data.details
            : `Create product failed (${response.status}).`;
        setError(String(message));
        return;
      }

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event(LOCAL_PRODUCTS_UPDATED_EVENT));
      }

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
  const filteredTypeOptions = typeOptions.filter((item) => {
    if (!form.category) return false;
    if (item.categoryId) return String(item.categoryId) === String(form.category);
    return true;
  });
  const hasTypeOptions = filteredTypeOptions.length > 0;
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
                <label>Category</label>
                <select name="category" value={form.category} onChange={handleChange}>
                  <option value="">
                    {categoryLoading ? "Loading categories..." : "Select Category"}
                  </option>
                  {categoryOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {!categoryLoading && !hasCategoryOptions ? (
                  <div className="mt-2 text-xs text-slate-500">
                    No categories available yet. Ask admin to create categories first.
                  </div>
                ) : null}
              </div>
              <div className="field">
                <label>Product Type</label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  disabled={!form.category}
                >
                  <option value="">
                    {!form.category
                      ? "Select category first"
                      : catalogLoading
                      ? "Loading product types..."
                      : "Select Product Type"}
                  </option>
                  {filteredTypeOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {form.category && !catalogLoading && !hasTypeOptions ? (
                  <div className="mt-2 text-xs text-slate-500">
                    No product types available for this category yet.
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
                  <div className="mt-2 text-xs text-slate-500">No brands available yet.</div>
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
                  accept="image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.avif,.tif,.tiff,.heic,.heif"
                  onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
                />
                <span className="upload-icon">&#8593;</span>
                <div className="upload-title">Upload Cover Photo</div>
                <div className="upload-note">Allowed all image types</div>
                <div className="upload-note">Max size 3 MB</div>
                {coverFile ? <div className="upload-filename">{coverFile.name}</div> : null}
              </label>
              <label className="upload-card">
                <input
                  type="file"
                  accept="image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.avif,.tif,.tiff,.heic,.heif"
                  multiple
                  onChange={(event) =>
                    setImageFiles(event.target.files ? Array.from(event.target.files) : [])
                  }
                />
                <span className="upload-icon">&#8593;</span>
                <div className="upload-title">Upload Product Photos</div>
                <div className="upload-note">Allowed all image types</div>
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
