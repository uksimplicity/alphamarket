const rawApiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const apiRoot = rawApiBase.replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
const fallbackImage = "https://images.unsplash.com/photo-1557821552-17105176677c?auto=format&fit=crop&w=900&q=80";

export function marketplaceImage(url: string) {
  const local: Record<string, string> = { "photo-1542291026-7eec264c27ff": "/buyer/buyer-style.jpg", "photo-1505740420928-5e560c06d30e": "/buyer/buyer-tech.jpg", "photo-1505691938895-1758d7feb511": "/buyer/buyer-home.jpg" };
  for (const [photo, path] of Object.entries(local)) if (url.startsWith("https://images.unsplash.com/") && url.includes(photo)) return path;
  return url;
}

function mediaValue(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["url", "file_url", "fileUrl", "path", "src", "location", "value"]) {
    if (typeof record[key] === "string" && record[key].trim()) return record[key].trim();
  }
  return "";
}

export function productImage(input: Record<string, unknown>): string {
  const media = input.media && typeof input.media === "object"
    ? input.media as Record<string, unknown> : null;
  const images = Array.isArray(media?.images) ? media.images : [];
  const raw = [media?.cover, media?.coverUrl, ...images, input.cover, input.image]
    .map(mediaValue).find(Boolean);
  if (!raw) return fallbackImage;
  if (/^(https?:|data:|blob:)/i.test(raw)) return marketplaceImage(raw);
  if (raw.startsWith("//")) return `https:${raw}`;
  const normalized = encodeURI(raw.replace(/\\/g, "/"));
  return apiRoot ? `${apiRoot}/${normalized.replace(/^\/+/, "")}` : normalized;
}
