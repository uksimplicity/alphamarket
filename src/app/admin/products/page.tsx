"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type Product = {
  id: string;
  name: string;
  category: string;
  status: string;
  sellerId: string;
};

type CatalogItem = {
  id: string;
  name: string;
  hint: string;
  categoryId?: string;
  categoryName?: string;
};

type ProductsData = {
  products: Product[];
  attributes: CatalogItem[];
  productTypes: CatalogItem[];
  categories: CatalogItem[];
  categoriesFromCache: boolean;
};

const ADMIN_PRODUCT_TYPES_CACHE_KEY = "alpha.admin.product-types";

function isPlaceholderId(value: string) {
  const id = value.trim().toLowerCase();
  return (
    !id ||
    id.startsWith("local-") ||
    id.startsWith("product-type-") ||
    id.startsWith("category-") ||
    id.startsWith("attribute-")
  );
}

function parseCatalogItems(
  payload: unknown,
  config?: { idKeys?: string[]; nameKeys?: string[]; hintKeys?: string[]; fallbackPrefix?: string }
) {
  const idKeys = config?.idKeys ?? ["id", "uuid"];
  const nameKeys = config?.nameKeys ?? ["name", "title"];
  const hintKeys = config?.hintKeys ?? ["description"];
  const listCandidates = [
    payload,
    asRecord(payload)?.data,
    asRecord(payload)?.items,
    asRecord(payload)?.results,
    asRecord(payload)?.rows,
    asRecord(payload)?.productTypes,
    asRecord(payload)?.product_types,
    asRecord(payload)?.categories,
    asRecord(payload)?.attributes,
  ];

  const rows = listCandidates
    .flatMap((candidate) => (Array.isArray(candidate) ? candidate : []))
    .flatMap((row) => (Array.isArray(row) ? row : [row]))
    .map((row) => asRecord(row))
    .filter((record): record is Record<string, unknown> => Boolean(record));

  const found = rows
    .map((record) => ({
      id: pickString(record, idKeys, "").trim(),
      name: pickString(record, nameKeys, "").trim(),
      hint: pickString(record, hintKeys, ""),
      categoryId: pickString(record, ["category_id", "categoryId"], ""),
      categoryName: pickString(record, ["category_name", "categoryName"], ""),
    }))
    .filter((item) => item.id && item.name);

  if (found.length > 0) {
    const byId = new Map<string, CatalogItem>();
    found.forEach((item) => {
      if (!byId.has(item.id)) byId.set(item.id, item);
    });
    return Array.from(byId.values());
  }

  return asArray(payload)
    .flatMap((row) => (Array.isArray(row) ? row : [row]))
    .map((row) => asRecord(row))
    .filter((record): record is Record<string, unknown> => Boolean(record))
    .map((record) => ({
      id: pickString(record, idKeys, "").trim(),
      name: pickString(record, nameKeys, "").trim(),
      hint: pickString(record, hintKeys, ""),
      categoryId: pickString(record, ["category_id", "categoryId"], ""),
      categoryName: pickString(record, ["category_name", "categoryName"], ""),
    }))
    .filter((item) => item.id && item.name);
}

function cacheProductTypes(types: CatalogItem[]) {
  if (typeof window === "undefined") return;
  try {
    const normalized = types
      .map((item) => ({
        id: String(item?.id ?? "").trim(),
        name: String(item?.name ?? "").trim(),
        categoryId: String(item?.categoryId ?? "").trim(),
        categoryName: String(item?.categoryName ?? item?.hint ?? "").trim(),
      }))
      .filter((item) => item.id && item.name);
    localStorage.setItem(ADMIN_PRODUCT_TYPES_CACHE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore localStorage failures
  }
}

function readCachedCatalogItems(key: string): CatalogItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item?.id ?? "").trim(),
        name: String(item?.name ?? "").trim(),
        hint: String(item?.categoryName ?? item?.hint ?? "").trim(),
        categoryId: String(item?.categoryId ?? "").trim(),
        categoryName: String(item?.categoryName ?? "").trim(),
      }))
      .filter((item) => item.id && item.name && !isPlaceholderId(item.id));
  } catch {
    return [];
  }
}

function readCachedProductsData(): ProductsData {
  return {
    products: [],
    attributes: [],
    productTypes: readCachedCatalogItems(ADMIN_PRODUCT_TYPES_CACHE_KEY),
    categories: readCachedCatalogItems("alpha.admin.categories"),
    categoriesFromCache: true,
  };
}

async function fetchOptionalAdminCollection(path: string, fallback: unknown = []): Promise<unknown> {
  try {
    return await adminFetcher<unknown>(path);
  } catch {
    return fallback;
  }
}

async function fetchOptionalCatalogCollection(path: string, fallback: unknown = []): Promise<unknown> {
  try {
    const response = await fetch(path, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return fallback;
    return (await response.json()) as unknown;
  } catch {
    return fallback;
  }
}

async function createProductTypeEndpoint(name: string, categoryId: string) {
  const variants: Array<Record<string, unknown>> = categoryId
    ? [
        { name, category_id: categoryId },
        { name, categoryId },
        { product_type: name, category_id: categoryId },
        { type_name: name, category_id: categoryId },
      ]
    : [{ name }, { product_type: name }, { type_name: name }];

  let lastError: unknown = null;
  for (const body of variants) {
    try {
      return await adminFetcher<unknown>("/product-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to create product type.");
}

function isTemporaryProductTypeId(id: string) {
  const normalized = id.trim().toLowerCase();
  return normalized.startsWith("tmppt-") || normalized.startsWith("local-");
}

async function deleteProductTypeEndpoint(id: string): Promise<void> {
  const paths = [
    `/product-types/${id}?hard=true`,
    `/product-types/${id}?force=true`,
    `/product-types/${id}`,
  ];

  let lastError: unknown = null;
  for (const path of paths) {
    try {
      await adminFetcher(path, { method: "DELETE" });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to delete product type.");
}

export default function AdminProductsPage() {
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [showProductTypeForm, setShowProductTypeForm] = useState(false);
  const [productTypeSearch, setProductTypeSearch] = useState("");
  const [activeHash, setActiveHash] = useState("");
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [cachedData, setCachedData] = useState<ProductsData>({
    products: [],
    attributes: [],
    productTypes: [],
    categories: [],
    categoriesFromCache: true,
  });
  const [productTypeForm, setProductTypeForm] = useState({
    name: "",
    categoryId: "",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncHash = () => {
      setActiveHash(window.location.hash.replace(/^#/, ""));
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const productsPayload = await fetchOptionalAdminCollection("/products?limit=100", []);
      const [attributesPayload, productTypesPayload, categoriesResult] = await Promise.all([
        fetchOptionalAdminCollection("/attributes?limit=100", []),
        (async () => {
          const payload = await fetchOptionalAdminCollection("/product-types?limit=100", null);
          if (payload) return payload;
          return readCachedCatalogItems(ADMIN_PRODUCT_TYPES_CACHE_KEY);
        })(),
        (async () => {
          const adminCandidates = [
            "/categories/raw?limit=200&offset=0",
            "/categories?limit=200&offset=0",
            "/categories?limit=200",
            "/categories",
          ];

          for (const path of adminCandidates) {
            const categoriesPayload = await fetchOptionalAdminCollection(path, null);
            if (categoriesPayload) {
              return {
                payload: categoriesPayload,
                fromCache: false,
              };
            }
          }

          const sellerCatalogPayload = await fetchOptionalCatalogCollection(
            "/api/seller/catalog?resource=categories&limit=200&offset=0",
            null
          );
          if (sellerCatalogPayload) {
            return {
              payload: sellerCatalogPayload,
              fromCache: false,
            };
          }
          return {
            payload: readCachedCatalogItems("alpha.admin.categories"),
            fromCache: true,
          };
        })(),
      ]);

      const products = asArray(productsPayload).map((row, index) => {
        const record = asRecord(row);
        return {
          id: pickString(record, ["id", "product_id", "uuid"], `product-${index}`),
          name: pickString(record, ["name", "title"], "Unnamed product"),
          category: pickString(record, ["category", "category_name", "categoryId"], "Uncategorized"),
          status: pickString(record, ["status"], "unknown"),
          sellerId: pickString(record, ["seller_id", "sellerId"], ""),
        } satisfies Product;
      });

      const attributes = parseCatalogItems(attributesPayload, {
        idKeys: ["id", "uuid", "attribute_id"],
        nameKeys: ["name", "title", "attribute_name"],
        fallbackPrefix: "attribute",
      });

      const productTypes = parseCatalogItems(productTypesPayload, {
        idKeys: ["id", "uuid", "product_type_id", "type_id"],
        nameKeys: ["name", "title", "product_type", "type_name"],
        hintKeys: ["category_id", "categoryId", "category_name", "categoryName"],
        fallbackPrefix: "product-type",
      });

      const categories = parseCatalogItems(categoriesResult.payload, {
        idKeys: ["id", "uuid", "category_id", "categoryId"],
        nameKeys: ["name", "title", "category_name", "categoryName"],
        fallbackPrefix: "category",
      });

      return {
        products,
        attributes,
        productTypes,
        categories,
        categoriesFromCache: categoriesResult.fromCache,
      } satisfies ProductsData;
    },
  });

  useEffect(() => {
    setCachedData(readCachedProductsData());
    setCacheHydrated(true);
  }, []);

  const resolvedData: ProductsData = data
    ? {
        products: data.products.length > 0 ? data.products : cachedData.products,
        attributes: data.attributes.length > 0 ? data.attributes : cachedData.attributes,
        productTypes: data.productTypes.length > 0 ? data.productTypes : cachedData.productTypes,
        categories: data.categories.length > 0 ? data.categories : cachedData.categories,
        categoriesFromCache: data.categoriesFromCache && cachedData.categories.length > 0,
      }
    : cachedData;

  useEffect(() => {
    if (!data) return;
    cacheProductTypes(data.productTypes);
    setCachedData((prev) => ({
      products: data.products.length > 0 ? data.products : prev.products,
      attributes: data.attributes.length > 0 ? data.attributes : prev.attributes,
      productTypes: data.productTypes.length > 0 ? data.productTypes : prev.productTypes,
      categories: data.categories.length > 0 ? data.categories : prev.categories,
      categoriesFromCache: data.categoriesFromCache,
    }));
  }, [data]);

  if (isLoading && !cacheHydrated && !data) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!resolvedData) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load products."}
        onRetry={refetch}
      />
    );
  }

  async function createAttribute() {
    const seed = { name: "Color", description: "", values: ["Red", "Blue"] };
    const input = window.prompt("Create attribute payload (JSON)", JSON.stringify(seed, null, 2));
    if (!input) return;
    try {
      setActionMessage("");
      setPendingKey("create-attribute");
      await adminFetcher("/attributes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: input,
      });
      setActionMessage("Attribute created.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to create attribute.");
    } finally {
      setPendingKey("");
    }
  }

  async function upsertAttribute(id: string, name: string) {
    const seed = { id, name, description: "", values: [] as string[] };
    const input = window.prompt("Update attribute payload (JSON)", JSON.stringify(seed, null, 2));
    if (!input) return;
    try {
      setActionMessage("");
      setPendingKey(`put-attribute-${id}`);
      await adminFetcher(`/attributes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: input,
      });
      setActionMessage("Attribute updated.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update attribute.");
    } finally {
      setPendingKey("");
    }
  }

  async function viewAttribute(id: string) {
    try {
      setPendingKey(`get-attribute-${id}`);
      const payload = await adminFetcher<unknown>(`/attributes/${id}`);
      window.alert(JSON.stringify(payload, null, 2));
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to fetch attribute.");
    } finally {
      setPendingKey("");
    }
  }

  async function deleteAttribute(id: string) {
    if (!window.confirm(`Delete attribute ${id}?`)) return;
    try {
      setPendingKey(`delete-attribute-${id}`);
      await adminFetcher(`/attributes/${id}`, { method: "DELETE" });
      setActionMessage("Attribute deleted.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to delete attribute.");
    } finally {
      setPendingKey("");
    }
  }

  async function createProductType() {
    const name = productTypeForm.name.trim();
    if (!name) {
      setActionMessage("Product type name is required.");
      return;
    }
    const categoryId = productTypeForm.categoryId.trim();
    if (categoryId && isPlaceholderId(categoryId)) {
      setActionMessage("Please select a saved category from the backend list.");
      return;
    }
    try {
      setActionMessage("");
      setPendingKey("create-product-type");
      const createdPayload = await createProductTypeEndpoint(name, categoryId);
      const parsedCreatedType = parseCatalogItems(createdPayload, {
        idKeys: ["id", "uuid", "product_type_id", "type_id"],
        nameKeys: ["name", "title", "product_type", "type_name"],
        hintKeys: ["category_id", "categoryId", "category_name", "categoryName"],
        fallbackPrefix: "product-type",
      })[0];
      const selectedCategory = resolvedData.categories.find((item) => item.id === categoryId);
      const createdType =
        parsedCreatedType ??
        ({
          id: `tmppt-${Date.now().toString(36)}`,
          name,
          hint: selectedCategory?.name ?? "",
          categoryId,
          categoryName: selectedCategory?.name ?? "",
        } satisfies CatalogItem);
      setActionMessage("Product type created.");
      setProductTypeForm({ name: "", categoryId: "" });
      setCachedData((prev) => {
        const nextProductTypes = [
          createdType,
          ...prev.productTypes.filter((item) => item.id !== createdType.id),
        ];
        cacheProductTypes(nextProductTypes);
        return { ...prev, productTypes: nextProductTypes };
      });
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create product type.";
      if (message.toLowerCase().includes("fk_product_types_category")) {
        setActionMessage("Selected category is invalid on backend. Reload categories and pick an existing one.");
      } else if (!categoryId) {
        setActionMessage(`${message} If your backend requires category mapping, select a category and try again.`);
      } else {
        setActionMessage(message);
      }
    } finally {
      setPendingKey("");
    }
  }

  async function viewProductType(id: string) {
    try {
      setPendingKey(`get-product-type-${id}`);
      const payload = await adminFetcher<unknown>(`/product-types/${id}`);
      window.alert(JSON.stringify(payload, null, 2));
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to fetch product type.");
    } finally {
      setPendingKey("");
    }
  }

  async function upsertProductType(id: string, name: string) {
    const seed = { id, name };
    const input = window.prompt("Update product type payload (JSON)", JSON.stringify(seed, null, 2));
    if (!input) return;
    try {
      setPendingKey(`put-product-type-${id}`);
      await adminFetcher(`/product-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: input,
      });
      setActionMessage("Product type updated.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update product type.");
    } finally {
      setPendingKey("");
    }
  }

  async function deleteProductType(id: string) {
    if (!window.confirm(`Delete product type ${id}?`)) return;
    try {
      setActionMessage("");
      setPendingKey(`delete-product-type-${id}`);
      if (isTemporaryProductTypeId(id)) {
        setActionMessage("Product type removed from local cache.");
      } else {
        await deleteProductTypeEndpoint(id);
        setActionMessage("Product type deleted.");
      }
      setCachedData((prev) => {
        const nextProductTypes = prev.productTypes.filter((item) => item.id !== id);
        cacheProductTypes(nextProductTypes);
        return { ...prev, productTypes: nextProductTypes };
      });
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete product type.";
      if (
        message.toLowerCase().includes("violates foreign key constraint") ||
        message.toLowerCase().includes("constraint")
      ) {
        setActionMessage("This product type is linked to existing products and cannot be deleted yet.");
      } else {
        setActionMessage(message);
      }
    } finally {
      setPendingKey("");
    }
  }

  const filteredProductTypes = resolvedData.productTypes.filter((item) => {
    const query = productTypeSearch.trim().toLowerCase();
    if (!query) return true;
    return item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query);
  });
  const selectableCategories = resolvedData.categories.filter((item) => !isPlaceholderId(item.id));
  const isProductTypesView = activeHash === "product-types";

  async function updateProduct(product: Product) {
    const seed = {
      product_id: product.id,
      seller_id: product.sellerId || "",
      name: product.name,
      description: "",
      base_price: 0,
      tag_ids: [] as string[],
      attributes: [] as Array<{ attribute_id: string; attribute_value_id: string }>,
    };
    const input = window.prompt("Update product payload (JSON)", JSON.stringify(seed, null, 2));
    if (!input) return;
    try {
      setPendingKey(`put-product-${product.id}`);
      await adminFetcher(`/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: input,
      });
      setActionMessage("Product updated.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to update product.");
    } finally {
      setPendingKey("");
    }
  }

  async function deleteProduct(id: string) {
    if (!window.confirm(`Delete product ${id}?`)) return;
    try {
      setPendingKey(`delete-product-${id}`);
      await adminFetcher(`/products/${id}`, { method: "DELETE" });
      setActionMessage("Product deleted.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to delete product.");
    } finally {
      setPendingKey("");
    }
  }

  async function viewProductAttributes(id: string) {
    try {
      setPendingKey(`get-product-attributes-${id}`);
      const payload = await adminFetcher<unknown>(`/products/${id}/attributes`);
      window.alert(JSON.stringify(payload, null, 2));
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to fetch product attributes.");
    } finally {
      setPendingKey("");
    }
  }

  return (
    <div className="grid gap-6">
      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error instanceof Error ? error.message : "Some admin data could not be refreshed."}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {actionMessage}
        </div>
      ) : null}

      {!isProductTypesView ? (
        <Card>
          <SectionTitle
            title="Seller Uploaded Products"
            subtitle="View all products uploaded by sellers. Admin can also create, update, or delete products."
            action={
              <Link href="/admin/products/create">
                <Button>Create Product</Button>
              </Link>
            }
          />
          <div className="mt-4 space-y-3 text-sm">
            {resolvedData.products.map((product) => (
              <div
                key={product.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
              >
                <div>
                  <div className="font-semibold text-slate-800">{product.name}</div>
                  <div className="text-xs text-slate-500">
                    {product.category} - Seller: {product.sellerId || "Admin"}
                  </div>
                </div>
                <div className="text-xs text-slate-500">{product.status}</div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    disabled={pendingKey === `get-product-attributes-${product.id}`}
                    onClick={() => viewProductAttributes(product.id)}
                  >
                    Attributes
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pendingKey === `put-product-${product.id}`}
                    onClick={() => updateProduct(product)}
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={pendingKey === `delete-product-${product.id}`}
                    onClick={() => deleteProduct(product.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {!isProductTypesView ? (
        <Card>
          <SectionTitle
            title="Attributes"
            subtitle="Manage product attributes."
            action={
              <Button
                disabled={pendingKey === "create-attribute"}
                onClick={createAttribute}
              >
                {pendingKey === "create-attribute" ? "Creating..." : "Add Attribute"}
              </Button>
            }
          />
          <div className="mt-4 space-y-3 text-sm">
            {resolvedData.attributes.map((attribute) => (
              <div
                key={attribute.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
              >
                <div>
                  <div className="font-semibold text-slate-800">{attribute.name}</div>
                  <div className="text-xs text-slate-500">{attribute.hint || "No description"}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    disabled={pendingKey === `get-attribute-${attribute.id}`}
                    onClick={() => viewAttribute(attribute.id)}
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={pendingKey === `put-attribute-${attribute.id}`}
                    onClick={() => upsertAttribute(attribute.id, attribute.name)}
                  >
                    Edit
                  </Button>
                  <Button
                    disabled={pendingKey === `delete-attribute-${attribute.id}`}
                    onClick={() => deleteAttribute(attribute.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <div id="product-types" className="h-0 scroll-mt-24" aria-hidden="true" />
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[34px] font-semibold leading-none text-slate-900">
            Product Types List
          </h2>
          <button
            type="button"
            onClick={() => setShowProductTypeForm((prev) => !prev)}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#2952cc]"
          >
            {showProductTypeForm ? "Close" : "Create Product Type"}
          </button>
        </div>

        {showProductTypeForm ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <input
                value={productTypeForm.name}
                onChange={(event) =>
                  setProductTypeForm((prev) => ({ ...prev, name: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                placeholder="Product Type Name"
              />
              <select
                value={productTypeForm.categoryId}
                onChange={(event) =>
                  setProductTypeForm((prev) => ({ ...prev, categoryId: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
              >
                <option value="">No category</option>
                {selectableCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pendingKey === "create-product-type"}
                onClick={createProductType}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pendingKey === "create-product-type" ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 md:grid-cols-[1fr] md:items-center">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" aria-hidden="true">
              <path
                d="M11 4a7 7 0 1 0 4.4 12.4L20 21"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              value={productTypeSearch}
              onChange={(event) => setProductTypeSearch(event.target.value)}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Search product types..."
            />
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50/90 text-sm font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3">
                  <input type="checkbox" aria-label="Select all product types" />
                </th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Product Type</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredProductTypes.map((type) => (
                <tr key={type.id}>
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={`Select product type ${type.name}`} />
                  </td>
                  <td className="px-4 py-3">#{type.id.slice(0, 5)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{type.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        disabled={pendingKey === `get-product-type-${type.id}`}
                        onClick={() => viewProductType(type.id)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={pendingKey === `put-product-type-${type.id}`}
                        onClick={() => upsertProductType(type.id, type.name)}
                      >
                        Edit
                      </Button>
                      <Button
                        disabled={pendingKey === `delete-product-type-${type.id}`}
                        onClick={() => deleteProductType(type.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProductTypes.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={4}>
                    No product types found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

