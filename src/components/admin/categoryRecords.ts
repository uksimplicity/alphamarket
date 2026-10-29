import { asRecord, pickString } from "./api";

export type Category = {
  id: string;
  name: string;
  createdBy: string;
  date: string;
};

export function isBackendCategoryId(id: string) {
  return Boolean(id.trim()) && !id.startsWith("local-") && !/^category-\d+$/.test(id);
}

// Only traverse response envelopes, so unrelated nested objects aren't categories.
export function extractCategoryRecords(payload: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const visited = new WeakSet<object>();
  function walk(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const record = asRecord(value);
    if (!record || visited.has(record)) return;
    visited.add(record);
    const id = pickString(record, ["id", "uuid", "category_id", "categoryId"]).trim();
    if (isBackendCategoryId(id)) records.push(record);
    for (const key of ["data", "category", "categories", "items", "results", "result", "payload", "record", "response"]) {
      walk(record[key]);
    }
  }
  walk(payload);
  return records;
}

export function normalizeCategories(payload: unknown, fallbackName = ""): Category[] {
  const categories = new Map<string, Category>();
  for (const record of extractCategoryRecords(payload)) {
    const id = pickString(record, ["id", "uuid", "category_id", "categoryId"]).trim();
    const name = pickString(record, ["name", "title", "category_name", "categoryName"], fallbackName).trim();
    if (!name) continue;
    categories.set(id, {
      id,
      name,
      createdBy: pickString(record, ["created_by", "createdBy"], "Admin"),
      date: pickString(record, ["created_at", "createdAt", "date"]),
    });
  }
  return Array.from(categories.values());
}
