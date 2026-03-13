"use client";

import { useState } from "react";
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
};

type ProductsData = {
  products: Product[];
  attributes: CatalogItem[];
  productTypes: CatalogItem[];
};

function toSlug(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminProductsPage() {
  const [pendingKey, setPendingKey] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const [productsPayload, attributesPayload, productTypesPayload] = await Promise.all([
        adminFetcher<unknown>("/products?limit=100"),
        adminFetcher<unknown>("/attributes?limit=100"),
        adminFetcher<unknown>("/product-types?limit=100"),
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

      const attributes = asArray(attributesPayload).map((row, index) => {
        const record = asRecord(row);
        return {
          id: pickString(record, ["id", "uuid"], `attribute-${index}`),
          name: pickString(record, ["name", "title"], "Unnamed attribute"),
          hint: pickString(record, ["description"], ""),
        } satisfies CatalogItem;
      });

      const productTypes = asArray(productTypesPayload).map((row, index) => {
        const record = asRecord(row);
        return {
          id: pickString(record, ["id", "uuid"], `product-type-${index}`),
          name: pickString(record, ["name", "title"], "Unnamed type"),
          hint: pickString(record, ["category_id", "categoryId"], ""),
        } satisfies CatalogItem;
      });

      return { products, attributes, productTypes } satisfies ProductsData;
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
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
    const seed = { name: "General", category_id: "" };
    const input = window.prompt("Create product type payload (JSON)", JSON.stringify(seed, null, 2));
    if (!input) return;
    try {
      setActionMessage("");
      setPendingKey("create-product-type");
      await adminFetcher("/product-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: input,
      });
      setActionMessage("Product type created.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to create product type.");
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
      setPendingKey(`delete-product-type-${id}`);
      await adminFetcher(`/product-types/${id}`, { method: "DELETE" });
      setActionMessage("Product type deleted.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to delete product type.");
    } finally {
      setPendingKey("");
    }
  }

  async function createProduct() {
    const seedName = "New Product";
    const seed = {
      name: seedName,
      slug: toSlug(seedName),
      sellerId: "",
      categoryId: "",
      productTypeId: "",
      basePrice: 0,
      shortDescription: "",
      stock: 0,
    };
    const input = window.prompt("Create product payload (JSON)", JSON.stringify(seed, null, 2));
    if (!input) return;
    try {
      setPendingKey("create-product");
      await adminFetcher("/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: input,
      });
      setActionMessage("Product created.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to create product.");
    } finally {
      setPendingKey("");
    }
  }

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
      {actionMessage ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {actionMessage}
        </div>
      ) : null}

      <Card>
        <SectionTitle
          title="Products"
          subtitle="Create, update, delete products and view product attributes."
          action={
            <Button disabled={pendingKey === "create-product"} onClick={createProduct}>
              {pendingKey === "create-product" ? "Creating..." : "Add Product"}
            </Button>
          }
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.products.map((product) => (
            <div
              key={product.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
            >
              <div>
                <div className="font-semibold text-slate-800">{product.name}</div>
                <div className="text-xs text-slate-500">{product.category}</div>
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
          {data.attributes.map((attribute) => (
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

      <Card>
        <SectionTitle
          title="Product Types"
          subtitle="Manage product type definitions."
          action={
            <Button
              disabled={pendingKey === "create-product-type"}
              onClick={createProductType}
            >
              {pendingKey === "create-product-type" ? "Creating..." : "Add Product Type"}
            </Button>
          }
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.productTypes.map((type) => (
            <div
              key={type.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{type.name}</div>
                <div className="text-xs text-slate-500">{type.hint || "No category linked"}</div>
              </div>
              <div className="flex gap-2">
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
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
