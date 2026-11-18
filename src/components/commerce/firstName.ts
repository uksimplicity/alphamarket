export function firstName(value: unknown): string {
  return typeof value === "string" ? value.trim().split(/\s+/)[0] || "" : "";
}
