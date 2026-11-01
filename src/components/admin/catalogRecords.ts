import { adminFetcher, asRecord } from "./api";

export type CatalogItem = { id: string; name: string; hint: string; categoryId?: string; categoryName?: string };

const fieldKey = (key: string) => key.replace(/[_-]/g, "").toLowerCase();
function catalogText(record: Record<string, unknown> | null, keys: string[]) {
  if (!record) return "";
  const fields = new Map(Object.entries(record).map(([key, value]) => [fieldKey(key), value]));
  for (const key of keys) {
    const value = fields.get(fieldKey(key));
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function parseCatalogItems(payload: unknown, config?: {
  idKeys?: string[]; nameKeys?: string[]; hintKeys?: string[]; fallbackPrefix?: string;
}): CatalogItem[] {
  const found = new Map<string, CatalogItem>();
  const visited = new WeakSet<object>();
  const isProductType = config?.idKeys?.some((key) => ["producttypeid", "typeid"].includes(fieldKey(key)));
  function walk(value: unknown) {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const record = asRecord(value);
    if (!record || visited.has(record)) return;
    visited.add(record);
    const id = catalogText(record, config?.idKeys ?? ["id", "uuid"]);
    const name = catalogText(record, [...(config?.nameKeys ?? ["name", "title"]), ...(isProductType ? ["product_type_name", "type_name", "type", "label"] : [])]);
    if (id && name) {
      const category = asRecord(Object.entries(record).find(([key]) => ["category", "parentcategory"].includes(fieldKey(key)))?.[1]);
      if (!found.has(id)) found.set(id, {
        id, name,
        hint: catalogText(record, config?.hintKeys ?? ["description"]),
        categoryId: catalogText(record, ["category_id"]) || catalogText(category, ["id", "uuid", "category_id"]),
        categoryName: catalogText(record, ["category_name"]) || catalogText(category, ["name", "title", "category_name"]),
      });
      return;
    }
    for (const [key, child] of Object.entries(record)) {
      if (isProductType && ["category", "categories", "parentcategory"].includes(fieldKey(key))) continue;
      if (Array.isArray(child) || asRecord(child)) walk(child);
    }
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
