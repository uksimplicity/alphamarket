function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function productTypeResponseError(payload: unknown): string | null {
  const root = record(payload);
  if (root?.success === false) {
    return typeof root.error === "string" ? root.error : typeof root.message === "string" ? root.message : "The product type request failed.";
  }
  const data = record(root?.data ?? root?.Data) ?? root;
  if (!data) return null;
  const keys = Object.keys(data).map((key) => key.replace(/[_-]/g, "").toLowerCase());
  const hasTypeIdentity = keys.some((key) => ["id", "producttypeid", "typeid"].includes(key)) &&
    keys.some((key) => ["name", "producttypename", "typename"].includes(key));
  if (keys.includes("products") && !keys.some((key) => key.includes("type")) && !hasTypeIdentity) {
    return "The product type service returned a products collection instead of product types. The backend route needs to be checked.";
  }
  return null;
}
