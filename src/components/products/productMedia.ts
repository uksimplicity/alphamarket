const rawApiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const apiRoot = rawApiBase.replace(/\/+$/, "").replace(/\/api\/v1$/i, "");
const fallbackImage = "https://images.unsplash.com/photo-1557821552-17105176677c?auto=format&fit=crop&w=900&q=80";

/** Drive viewer/download URLs are not embeddable image URLs. Keep the stored URL intact. */
function driveImage(url: string): string {
  try {
    const parsed = new URL(url.startsWith("//") ? `https:${url}` : url);
    if (!["https:", "http:"].includes(parsed.protocol) || !["drive.google.com", "docs.google.com", "drive.usercontent.google.com"].includes(parsed.hostname)) return url;
    const pathId = parsed.pathname.match(/^\/file\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1];
    const queryId = /^\/(?:uc|open|thumbnail|download)\/?$/.test(parsed.pathname) ? parsed.searchParams.get("id") : null;
    const id = pathId || queryId;
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return url;
    const resourceKey = parsed.searchParams.get("resourcekey");
    return `https://lh3.googleusercontent.com/d/${id}=w1600${resourceKey ? `?resourcekey=${encodeURIComponent(resourceKey)}` : ""}`;
  } catch { return url; }
}

export function marketplaceImage(url: string) {
  const local: Record<string, string> = { "photo-1542291026-7eec264c27ff": "/buyer/buyer-style.jpg", "photo-1505740420928-5e560c06d30e": "/buyer/buyer-tech.jpg", "photo-1505691938895-1758d7feb511": "/buyer/buyer-home.jpg" };
  for (const [photo, path] of Object.entries(local)) if (url.startsWith("https://images.unsplash.com/") && url.includes(photo)) return path;
  return driveImage(url);
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

export function productImage(input: Record<string, unknown>, fallback = fallbackImage): string {
  const media = input.media && typeof input.media === "object"
    ? input.media as Record<string, unknown> : null;
  const images = Array.isArray(media?.images) ? media.images : [];
  const raw = [media?.cover, media?.coverUrl, ...images, input.cover, input.cover_image, input.coverImage, input.image, ...(Array.isArray(input.images) ? input.images : [])]
    .map(mediaValue).find(Boolean);
  if (!raw) return fallback;
  if (/^(https?:|data:|blob:)/i.test(raw)) return marketplaceImage(raw);
  if (raw.startsWith("//")) return marketplaceImage(`https:${raw}`);
  const normalized = encodeURI(raw.replace(/\\/g, "/"));
  return apiRoot ? `${apiRoot}/${normalized.replace(/^\/+/, "")}` : normalized;
}
