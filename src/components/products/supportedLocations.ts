export type SupportedLocation = { id: string; name: string; type?: string; is_active?: boolean; parent_id?: string };

export function locationRows(payload: unknown): SupportedLocation[] | null {
  if (Array.isArray(payload)) {
    if (!payload.every(row => row && typeof row === "object" && typeof row.id === "string" && typeof row.name === "string")) return null;
    return payload as SupportedLocation[];
  }
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  if (value.success === false) return null;
  for (const key of ["data", "locations", "items", "rows"]) {
    if (key in value) { const rows = locationRows(value[key]); if (rows) return rows; }
  }
  return null;
}
