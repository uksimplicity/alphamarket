export type PlatformSetting = {
  key: string; value: string; description: string; type: "percent" | "number" | "integer" | "choice";
  unit?: string; min?: number; max?: number; options?: string[]; default_value?: string;
};

export function parseSettings(payload: unknown): PlatformSetting[] {
  const envelope = payload as { success?: boolean; data?: unknown } | null;
  if (envelope?.success === false) throw new Error("Platform settings could not be loaded.");
  const rows = Array.isArray(payload) ? payload : envelope?.data;
  if (!Array.isArray(rows)) throw new Error("The server returned an unreadable settings list.");
  const keys = new Set<string>();
  return rows.map(row => {
    if (!row || typeof row.key !== "string" || !/^[\w.-]+$/.test(row.key) || keys.has(row.key)
      || typeof row.value !== "string" || !["percent", "number", "integer", "choice"].includes(row.type)
      || [row.min, row.max].some(bound => bound !== undefined && (typeof bound !== "number" || !Number.isFinite(bound)))
      || (row.min !== undefined && row.max !== undefined && row.min > row.max)
      || (row.type === "choice" && (!Array.isArray(row.options) || !row.options.length || row.options.some((option: unknown) => typeof option !== "string")))) {
      throw new Error("The server returned invalid setting details. Refresh before editing.");
    }
    keys.add(row.key);
    return { ...row, description: typeof row.description === "string" ? row.description : "" } as PlatformSetting;
  });
}

export function settingError(setting: PlatformSetting, value: string, values: Record<string, string> = {}): string {
  if (!value.trim()) return "Enter a value.";
  if (setting.type === "choice") return setting.options?.includes(value) ? "" : "Choose an available option.";
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) || !Number.isFinite(Number(value))) return "Enter a valid number.";
  const number = Number(value);
  if (setting.type === "integer" && !Number.isInteger(number)) return "Enter a whole number.";
  const min = setting.min ?? (setting.type === "percent" ? 0 : undefined);
  const max = setting.max ?? (setting.type === "percent" ? 100 : undefined);
  if (min !== undefined && number < min) return `Enter ${min} or more.`;
  if (max !== undefined && number > max) return `Enter ${max} or less.`;
  if (setting.key === "delivery_min_fee" && values.delivery_max_fee !== undefined && number > Number(values.delivery_max_fee)) return "Minimum fee must not exceed the saved maximum fee.";
  if (setting.key === "delivery_max_fee" && values.delivery_min_fee !== undefined && number < Number(values.delivery_min_fee)) return "Maximum fee must not be below the saved minimum fee.";
  return "";
}

export function sameSettingValue(setting: PlatformSetting, a: string, b: string) {
  return setting.type === "choice" ? a === b : a.trim() !== "" && b.trim() !== "" && Number(a) === Number(b);
}

export function settingLabel(key: string) {
  const labels: Record<string, string> = {
    marketplace_commission_rate: "Marketplace commission", rider_commission_rate: "Rider commission",
    escrow_timeout_hours: "Escrow release window", min_withdrawal_amount: "Minimum withdrawal",
    delivery_fee_recipient: "Delivery fee recipient", max_delivery_distance_km: "Maximum delivery distance",
    delivery_min_fee: "Minimum delivery fee", delivery_max_fee: "Maximum delivery fee", ride_refund_destination: "Ride refund destination",
  };
  if (labels[key]) return labels[key];
  const band = key.match(/^delivery_(base_fee|per_km)_(.+)$/);
  if (band) return `${band[2].replaceAll("_", " ")} ${band[1] === "base_fee" ? "base fee" : "rate per km"}`.replace(/^./, letter => letter.toUpperCase());
  return key.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

export function settingGroup(key: string) {
  if (key.startsWith("delivery_") || key === "max_delivery_distance_km") return "Delivery pricing";
  if (key.includes("commission")) return "Commissions";
  return "Escrow & payments";
}
