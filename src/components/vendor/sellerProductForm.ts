export type ReferenceOption = { id: string; name: string };
export const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function referenceOptions(payload: unknown): ReferenceOption[] {
  if (Array.isArray(payload)) return payload.flatMap(value => {
    const row = asRecord(value), id = row.id ?? row.uuid ?? row.attribute_value_id ?? row.category_id ?? row.brand_id ?? row.product_type_id;
    const name = row.name ?? row.title ?? row.label ?? row.value;
    return (typeof id === "string" || typeof id === "number") && (typeof name === "string" || typeof name === "number") ? [{ id: String(id), name: String(name) }] : [];
  });
  const row = asRecord(payload);
  for (const key of ["data", "items", "rows", "categories", "brands", "product_types", "productTypes", "attributes", "values", "attribute_values"]) {
    if (row[key] !== undefined) { const options = referenceOptions(row[key]); if (options.length) return options; }
  }
  return [];
}
export function uploadedMediaUrl(value: unknown) {
  const row = asRecord(value), nested = asRecord(row.data);
  const url = row.url ?? row.file_url ?? row.path ?? nested.url ?? nested.file_url ?? nested.path;
  if (typeof url !== "string") throw new Error("The upload did not return an image URL.");
  try { if (["http:", "https:"].includes(new URL(url).protocol)) return url; } catch { /* validated below */ }
  throw new Error("The upload did not return a valid image URL.");
}
export function editedMedia(product: Record<string, unknown>, cover?: string, images?: string[]) {
  const old = asRecord(product.media);
  return { ...old, cover: cover ?? old.cover ?? old.coverUrl ?? product.cover ?? "", images: images ?? old.images ?? product.images ?? [] };
}
