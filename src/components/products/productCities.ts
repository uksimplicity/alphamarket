export type ProductCity = { id: string; name: string };

export function productCityPage(payload: unknown): { cities: ProductCity[]; total?: number; count: number } {
  const envelope = payload as { success?: boolean; data?: unknown; meta?: { total?: unknown } } | null;
  if (envelope?.success === false) throw new Error("Product cities could not be loaded.");
  const rows = Array.isArray(payload) ? payload : envelope?.data;
  if (!Array.isArray(rows)) throw new Error("The server returned an unreadable city list.");
  const cities: ProductCity[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") throw new Error("The server returned an invalid city.");
    const id = row.id ?? row.ID, name = row.name ?? row.Name;
    const type = row.type ?? row.Type;
    if (row.is_active === false || row.IsActive === false || type && type !== "city") continue;
    if (typeof id !== "string" || !id.trim() || typeof name !== "string" || !name.trim()) throw new Error("The server returned an invalid city.");
    cities.push({ id: id.trim(), name: name.trim() });
  }
  const total = envelope?.meta?.total;
  if (total !== undefined && (typeof total !== "number" || !Number.isSafeInteger(total) || total < 0)) throw new Error("The server returned invalid city pagination.");
  return { cities, count: rows.length, ...(typeof total === "number" ? { total } : {}) };
}
