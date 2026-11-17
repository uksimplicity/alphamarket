export function revenuePeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value || "";
  const month = `${part("year")}-${part("month")}`;
  return { startDate: `${month}-01`, endDate: `${month}-${part("day")}` };
}

export function revenueReport(payload: unknown, period: ReturnType<typeof revenuePeriod>) {
  const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const root = record(payload);
  if (root.success === false) throw new Error(typeof root.error === "string" ? root.error : "Revenue report could not be loaded.");
  const row = record(root.data ?? root);
  if (row.success === false) throw new Error("Revenue report could not be loaded.");
  const amount = (key: string) => {
    const value = row[key];
    if ((typeof value !== "string" && typeof value !== "number") || String(value).trim() === "" || !Number.isFinite(Number(value))) return "Not reported";
    return String(value).trim();
  };
  const date = (key: string, fallback: string) => typeof row[key] === "string" && /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(row[key]) ? row[key].slice(0, 10) : fallback;
  return [
    { label: "Period", value: `${date("start_date", period.startDate)} to ${date("end_date", period.endDate)}` },
    { label: "Total Revenue", value: amount("total_revenue") },
    { label: "Total Commission", value: amount("total_commission") },
    { label: "Total Orders", value: amount("total_orders") },
  ];
}
