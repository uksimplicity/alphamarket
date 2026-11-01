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
  if (row.success === false) throw new Error(uploadErrorMessage(value) || "The upload service rejected the file.");
  for (const record of [asRecord(nested.file), asRecord(row.file), nested, row]) {
    for (const key of ["url", "file_url", "fileUrl", "path"]) {
      const url = record[key];
      if (typeof url !== "string" || !url.trim()) continue;
      try { if (["http:", "https:"].includes(new URL(url).protocol)) return url.trim(); } catch { /* Try other URL fields. */ }
    }
  }
  throw new Error("The upload did not return a valid image URL.");
}
function uploadErrorMessage(value: unknown): string {
  const row = asRecord(value), error = asRecord(row.error);
  return [row.error, error.message, row.message].find((item): item is string => typeof item === "string" && Boolean(item.trim()))?.trim() ?? "";
}
export async function uploadProductMedia(file: File, authorization: string): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", "products");
  const token = authorization.trim();
  let response: Response;
  try {
    response = await fetch("/api/upload/file", {
      method: "POST", headers: { Authorization: /^Bearer\s+/i.test(token) ? token : `Bearer ${token}` }, body: form,
    });
  } catch { throw new Error(`Could not upload "${file.name}". Check your connection and try again.`); }
  let data: unknown;
  try { data = await response.json(); } catch { /* Report the HTTP status without displaying an HTML error page. */ }
  if (!response.ok) {
    const message = response.status === 413 ? "File is too large. Maximum size is 3 MB."
      : response.status === 401 ? "Your session has expired. Sign in again."
      : uploadErrorMessage(data) || "The upload service rejected the file.";
    throw new Error(`Could not upload "${file.name}" (${response.status}). ${message}`);
  }
  try { return uploadedMediaUrl(data); }
  catch (error) { throw new Error(`Could not upload "${file.name}". ${error instanceof Error ? error.message : "No image URL was returned."}`); }
}
export function editedMedia(product: Record<string, unknown>, cover?: string, images?: string[]) {
  const old = asRecord(product.media);
  return { ...old, cover: cover ?? old.cover ?? old.coverUrl ?? product.cover ?? "", images: images ?? old.images ?? product.images ?? [] };
}
