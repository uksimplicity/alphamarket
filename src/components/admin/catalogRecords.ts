import { adminFetcher, asRecord, pickString } from "./api";

export type CatalogItem = { id: string; name: string; hint: string; categoryId?: string; categoryName?: string };

export function parseCatalogItems(payload: unknown, config?: {
  idKeys?: string[]; nameKeys?: string[]; hintKeys?: string[]; fallbackPrefix?: string;
}): CatalogItem[] {
  const found = new Map<string, CatalogItem>();
  function walk(value: unknown) {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const record = asRecord(value);
    if (!record) return;
    const id = pickString(record, config?.idKeys ?? ["id", "uuid"]).trim();
    const name = pickString(record, config?.nameKeys ?? ["name", "title"]).trim();
    if (id && name) {
      const category = asRecord(record.category);
      if (!found.has(id)) found.set(id, {
        id, name,
        hint: pickString(record, config?.hintKeys ?? ["description"]),
        categoryId: pickString(record, ["category_id", "categoryId"]).trim() || pickString(category, ["id", "uuid", "category_id"]).trim(),
        categoryName: pickString(record, ["category_name", "categoryName"]).trim() || pickString(category, ["name", "title", "category_name"]).trim(),
      });
      return;
    }
    for (const key of ["data", "items", "results", "rows", "productTypes", "product_types", "product_type", "productType", "categories", "category", "attributes", "attribute"]) walk(record[key]);
  }
  walk(payload);
  return [...found.values()];
}

export function isTemporaryProductTypeId(id: string) {
  return !id.trim() || /^(tmppt|local|product-type)-/i.test(id.trim());
}

function withCategory(type: CatalogItem, categories: CatalogItem[]): CatalogItem {
  return { ...type, categoryName: categories.find((category) => category.id === type.categoryId)?.name || type.categoryName || "" };
}

export async function loadProductTypeDetails(type: CatalogItem, categories: CatalogItem[]): Promise<CatalogItem> {
  let details = withCategory(type, categories);
  if (details.categoryName || isTemporaryProductTypeId(type.id)) return details;
  if (!details.categoryId) {
    const payload = await adminFetcher<unknown>(`/product-types/${encodeURIComponent(type.id)}`);
    const record = parseCatalogItems(payload, {
      idKeys: ["id", "uuid", "product_type_id", "type_id"],
      nameKeys: ["name", "title", "product_type", "type_name"],
    }).find((item) => item.id === type.id);
    if (!record) throw new Error("Product type details are unavailable. Please refresh.");
    details = withCategory({ ...type, ...record, categoryId: record.categoryId || type.categoryId, categoryName: record.categoryName || type.categoryName }, categories);
  }
  if (!details.categoryName && details.categoryId && !/^(local|category)-/i.test(details.categoryId)) {
    const payload = await adminFetcher<unknown>(`/categories/${encodeURIComponent(details.categoryId)}`);
    const category = parseCatalogItems(payload, { idKeys: ["id", "uuid", "category_id", "categoryId"], nameKeys: ["name", "title", "category_name", "categoryName"] })
      .find((item) => item.id === details.categoryId);
    if (category) details = { ...details, categoryName: category.name };
  }
  return details;
}
