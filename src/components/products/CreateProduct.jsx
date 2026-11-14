"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import "@/components/products/CreateProduct.css";
import { getAuth } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { uploadProductMedia } from "@/components/vendor/sellerProductForm";
import { useToast } from "@/components/ToastProvider";
import { nigeriaLGAs, nigeriaStates } from "@/data/nigeriaLocations";
import { fullAddress } from "@/components/commerce/structuredAddress";
import { locationRows } from "@/components/products/supportedLocations";

const initialForm = {
  name: "",
  category: "",
  type: "",
  brand: "",
  brandName: "",
  shortDescription: "",
  basePrice: "",
  stock: "",
  location: "",
  locationId: "",
  houseNumber: "",
  street: "",
  state: "",
  lga: "",
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
    "brand_id",
    "brandId",
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
    "brand_name",
    "brandName",
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
          "brand_id",
          "brandId",
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
          "brand_name",
          "brandName",
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

function PhotoPreview({ file, onRemove, disabled }) {
  const imageRef = useRef(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    imageRef.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <div className="product-photo-preview">
    {/* Local blob previews do not use the image optimization service. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img ref={imageRef} alt={file.name} />
    <span>{file.name}</span>
    <button type="button" disabled={disabled} onClick={onRemove} aria-label={`Remove ${file.name}`}>Remove</button>
  </div>;
}

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

/** @param {{ mode?: string, onCreated?: (() => void) | null }} props */
export default function CreateProduct({ mode = "seller", onCreated = null }) {
  const showToast = useToast();
  // Reuse requests across development effect replays for this form instance.
  const catalogRequests = useRef(new Map());
  const uploadedFiles = useRef(new WeakMap());
  const submitting = useRef(false);
  const [form, setForm] = useState(initialForm);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [typeOptions, setTypeOptions] = useState([]);
  const [brandOptions, setBrandOptions] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [brandError, setBrandError] = useState("");
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [submitIntent, setSubmitIntent] = useState("publish");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [coverFile, setCoverFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [locations, setLocations] = useState([]);
  const [locationsError, setLocationsError] = useState("");
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsAttempt, setLocationsAttempt] = useState(0);
  const router = useRouter();



  useEffect(() => {
    let isMounted = true;

    function requestOnce(key, request) {
      if (!catalogRequests.current.has(key)) {
        catalogRequests.current.set(key, request());
      }
      return catalogRequests.current.get(key);
    }

    async function requestCatalog(resource) {
      return requestOnce(resource, async () => {
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
      });
    }

    async function requestAdminCategories() {
      return requestOnce("admin-categories", async () => {
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
      });
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
          setBrandError(
            brandsResult.reason instanceof Error
              ? brandsResult.reason.message
              : "Failed to load brands."
          );
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

    void loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (mode !== "seller") return;
    let active = true;
    const key = `locations-${locationsAttempt}`;
    if (!catalogRequests.current.has(key)) {
      catalogRequests.current.set(key, (async () => {
        const authorization = buildAuthorizationHeader(getAuth()?.access_token);
        const response = await fetch("/api/seller/locations", { headers: { Authorization: authorization } });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load supported locations.");
        const rows = locationRows(payload);
        if (!rows) throw new Error("Supported locations could not be read. Please retry.");
        return rows.filter((row) => row.is_active !== false);
      })());
    }
    void catalogRequests.current.get(key).then((rows) => {
      if (active) { setLocations(rows); setLocationsError(""); setLocationsLoading(false); }
    }).catch((failure) => {
      if (active) { setLocationsError(failure instanceof Error ? failure.message : "Could not load supported locations."); setLocationsLoading(false); }
    });
    return () => { active = false; };
  }, [mode, locationsAttempt]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "category") {
        return { ...prev, category: value, type: "" };
      }
      if (name === "state") return { ...prev, state: value, lga: "" };
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    const intent = event.nativeEvent?.submitter?.value || submitIntent;
    const isDraft = intent === "draft";
    setSubmitIntent(intent);
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
    if (!form.location.trim()) {
      setError("Enter the city where this product is located.");
      return;
    }
    if (mode === "seller") {
      if (!form.locationId || !locations.some((row) => row.id === form.locationId)) {
        setError("Select a supported location from the dropdown.");
        return;
      }
      if (!form.houseNumber.trim() || !form.street.trim() || !form.state || !form.lga) {
        setError("Complete the house number, street, state and local government area.");
        return;
      }
      if (!nigeriaLGAs[form.state]?.includes(form.lga)) {
        setError("Select a local government area in the selected state.");
        return;
      }
    }
    if (mode === "seller" && !coverFile && imageFiles.length === 0) {
      setError("Add at least one product image.");
      return;
    }
    if (form.brand.trim() && !isUuid(form.brand.trim())) {
      setError("Brand must be a valid UUID.");
      return;
    }
    if (!form.brand.trim() && form.brandName.trim().length > 150) {
      setError("Brand name must be 150 characters or fewer.");
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
      if (!form.basePrice.trim() || discountPriceNumber >= basePriceNumber) {
        setError("Discount price must be less than the base price.");
        return;
      }
      const start = Date.parse(form.discountStartDate);
      const end = Date.parse(form.discountEndDate);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        setError("Discount end date must be on or after the start date.");
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
      status: isDraft ? "draft" : "publish",
      isPublished: !isDraft,
    };

    payload.location = form.location.trim();
    if (mode === "seller") {
      payload.locationId = form.locationId;
      payload.address = fullAddress(form);
    }
    if (form.shortDescription.trim()) payload.shortDescription = form.shortDescription.trim();
    const selectedBrandId = form.brand.trim();
    if (selectedBrandId && isUuid(selectedBrandId)) {
      payload.brandId = selectedBrandId;
    } else if (form.brandName.trim()) {
      payload.brandName = form.brandName.trim();
    }
    if (stockNumber !== null) payload.stock = stockNumber;
    if (tagList.length > 0) payload.tags = tagList;
    // Preserve the submission behavior from before the address/map UI: use the
    // seller coordinates already supplied by the authenticated account.
    const latitude = readFirstFiniteNumber(
      auth?.user?.latitude, auth?.user?.lat,
      auth?.user?.profile?.latitude, auth?.user?.profile?.lat
    );
    const longitude = readFirstFiniteNumber(
      auth?.user?.longitude, auth?.user?.lng,
      auth?.user?.profile?.longitude, auth?.user?.profile?.lng
    );
    // A new product address is geocoded by the backend; saved account
    // coordinates may describe a different address.
    if (!payload.address && latitude !== null) payload.latitude = latitude;
    if (!payload.address && longitude !== null) payload.longitude = longitude;

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
      const stamp = accountStamp();
      submitting.current = true;
      setLoading(true);

      if (mode === "seller" && form.location.trim()) {
        const response = await fetch(`/api/seller/products/validate-city?locationId=${encodeURIComponent(form.locationId)}`, {
          headers: { Authorization: authorization },
        });
        const result = await response.json();
        if (!response.ok || result.success === false) throw new Error(result.error || "Could not validate this city.");
        checkAccount(stamp);
      }

      async function uploadOnce(file) {
        checkAccount(stamp);
        const cached = uploadedFiles.current.get(file);
        if (cached?.stamp === stamp) return cached.url;
        const url = await uploadProductMedia(file, authorization);
        checkAccount(stamp);
        uploadedFiles.current.set(file, { stamp, url });
        return url;
      }
      const coverUrl = coverFile ? await uploadOnce(coverFile) : "";
      // Let every gallery upload finish so a retry cannot overlap pending work.
      const imageResults = await Promise.allSettled(imageFiles.map(uploadOnce));
      const failedImage = imageResults.find((result) => result.status === "rejected");
      if (failedImage) throw failedImage.reason;
      const imageUrls = imageResults.map((result) => result.value);
      const videoUrl = videoFile ? await uploadOnce(videoFile) : "";

      if (coverFile || imageFiles.length || videoFile) {
        payload.media = {
          cover: coverUrl,
          images: imageUrls.filter(Boolean),
          video: videoUrl,
        };
      }
      checkAccount(stamp);

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
      checkAccount(stamp);

      if (!response.ok || data?.success === false) {
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

      const successMessage = isDraft
          ? "Draft saved successfully."
          : "Product published successfully.";
      setSuccess(successMessage);
      showToast(successMessage);
      if (onCreated) onCreated();
      else router.push(mode === "admin" ? "/admin/products" : "/vendor/products");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Create product failed.");
    } finally {
      submitting.current = false;
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
  const locationsById = new Map(locations.map((row) => [row.id, row]));
  function locationLabel(row) {
    const names = [row.name];
    const seen = new Set([row.id]);
    let parent = locationsById.get(row.parent_id);
    while (parent && !seen.has(parent.id)) {
      names.unshift(parent.name);
      seen.add(parent.id);
      parent = locationsById.get(parent.parent_id);
    }
    return names.join(" > ");
  }

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
          <fieldset disabled={loading} className="create-form-fields">
          <p className="text-sm text-slate-500">Product name, category, product type, base price, description, and location are required.{mode === "seller" ? " Add at least one product image." : ""}</p>
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
                <label htmlFor="product-brand">Brand (optional)</label>
                <select
                  id="product-brand"
                  name="brand"
                  value={form.brand}
                  onChange={handleChange}
                  disabled={catalogLoading || loading}
                >
                  <option value="">
                    {catalogLoading
                      ? "Loading brands..."
                      : "No brand"}
                  </option>
                  {brandOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {brandError ? <div className="mt-2 text-xs text-red-600" role="alert">{brandError}</div> : null}
                {!catalogLoading && !brandError && !hasBrandOptions ? (
                  <div className="mt-2 text-xs text-slate-500">No brands available yet.</div>
                ) : null}
              </div>
                <div className="field">
                  <label htmlFor="product-brand-name">Brand name (optional)</label>
                  <input
                    id="product-brand-name"
                    name="brandName"
                    value={form.brandName}
                    onChange={handleChange}
                    maxLength={150}
                    disabled={loading || Boolean(form.brand)}
                    aria-describedby="product-brand-name-help"
                    placeholder="e.g. Apple"
                  />
                  <p id="product-brand-name-help" className="mt-2 text-xs text-slate-500">
                    {form.brand
                      ? "Select No brand above to enter a different brand name."
                      : "Enter a brand if it isn't listed. Leave blank to identify it from the product name."}
                  </p>
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
                <p className="helper-text">Enter your selling price. You receive this full price. The buyer pays this price plus admin commission and delivery.</p>
              </div>
              <div className="field">
                <label>Stock (optional)</label>
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
              {mode === "seller" ? <>
                <div className="field full">
                  <label htmlFor="product-location-id">Supported location</label>
                  <select id="product-location-id" name="locationId" value={form.locationId} onChange={handleChange} disabled={loading || locationsLoading} aria-describedby="product-location-id-help">
                    <option value="">{locationsLoading ? "Loading locations..." : "Select supported location"}</option>
                    {locations.map((row) => <option key={row.id} value={row.id}>{locationLabel(row)}</option>)}
                  </select>
                  <p id="product-location-id-help" className="text-sm text-slate-500">Choose the most specific city or area available for your product.</p>
                  {locationsError ? <div role="alert" className="form-error">{locationsError} <button type="button" className="btn-outline" disabled={loading || locationsLoading} onClick={() => { setLocationsLoading(true); setLocationsAttempt((attempt) => attempt + 1); }}>Retry locations</button></div> : null}
                  {!locationsLoading && !locationsError && !locations.length ? <p role="status" className="text-sm text-slate-500">No supported locations are available. Ask an administrator to add or activate your location.</p> : null}
                </div>
                <div className="field">
                  <label htmlFor="product-house-number">House number</label>
                  <input id="product-house-number" name="houseNumber" value={form.houseNumber} onChange={handleChange} placeholder="e.g. 12B" />
                </div>
                <div className="field">
                  <label htmlFor="product-street">Street</label>
                  <input id="product-street" name="street" value={form.street} onChange={handleChange} autoComplete="street-address" placeholder="e.g. Allen Avenue" />
                </div>
                <div className="field">
                  <label htmlFor="product-state">State</label>
                  <select id="product-state" name="state" value={form.state} onChange={handleChange} autoComplete="address-level1">
                    <option value="">Select state</option>
                    {nigeriaStates.map((state) => <option key={state} value={state}>{state}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="product-lga">Local government area</label>
                  <select id="product-lga" name="lga" value={form.lga} onChange={handleChange} disabled={!form.state} autoComplete="address-level2">
                    <option value="">{form.state ? "Select local government area" : "Select state first"}</option>
                    {(nigeriaLGAs[form.state] || []).map((lga) => <option key={lga} value={lga}>{lga}</option>)}
                  </select>
                </div>
              </> : null}
              <div className="field">
                <label htmlFor="product-city">Location</label>
                <input id="product-city" name="location" type="text" autoComplete="address-level2" value={form.location} onChange={handleChange} disabled={loading} placeholder="Enter your city, e.g. Lagos" aria-describedby="product-city-help" />
                <p id="product-city-help" className="text-sm text-slate-500">Describe where the product is located.</p>
              </div>
            </div>
          </section>

          <section className="form-section">
            <div className="section-title">{mode === "seller" ? "Product Images" : "Media (optional)"}</div>
            {mode === "seller" ? <p className="mb-3 text-sm text-slate-500">Add at least one cover photo or product photo. Video is optional.</p> : null}
            <div className="media-grid">
              <label className="upload-card">
                <input
                  type="file"
                  disabled={loading}
                  accept="image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.avif,.tif,.tiff,.heic,.heif"
                  onChange={(event) => { const file = event.target.files?.[0]; if (file) setCoverFile(file); event.target.value = ""; }}
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
                  disabled={loading}
                  accept="image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.avif,.tif,.tiff,.heic,.heif"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    setImageFiles((previous) => [...previous, ...files]);
                    event.target.value = "";
                  }}
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
                  disabled={loading}
                  accept=".mp4,.mov,.avi"
                  onChange={(event) => { const file = event.target.files?.[0]; if (file) setVideoFile(file); event.target.value = ""; }}
                />
                <span className="upload-icon">&#8593;</span>
                <div className="upload-title">Upload Video (optional)</div>
                <div className="upload-note">Allowed *.mp4, *.mov, *.avi</div>
                <div className="upload-note">Max size 3 MB</div>
                {videoFile ? <div className="upload-filename">{videoFile.name}</div> : null}
              </label>
            </div>
            <div className="product-photo-previews">
              {coverFile ? <PhotoPreview file={coverFile} disabled={loading} onRemove={() => setCoverFile(null)} /> : null}
              {imageFiles.map((file, index) => <PhotoPreview key={index} file={file} disabled={loading} onRemove={() => setImageFiles((previous) => previous.filter((_, position) => position !== index))} />)}
            </div>
            {videoFile ? <button type="button" className="btn-outline" disabled={loading} onClick={() => setVideoFile(null)}>Remove video</button> : null}
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
              name="intent"
              value="draft"
              onClick={() => setSubmitIntent("draft")}
            >
              {loading && submitIntent === "draft" ? "Saving draft..." : "Save Draft"}
            </button>
            <button
              type="submit"
              className="btn-save"
              disabled={loading}
              name="intent"
              value="publish"
              onClick={() => setSubmitIntent("publish")}
            >
              {loading && submitIntent === "publish" ? "Publishing..." : "Publish Product"}
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
