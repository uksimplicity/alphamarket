import type { Product } from "@/components/products/catalog";
import { productImage } from "@/components/products/productMedia";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (...values: unknown[]) => values.find(value => typeof value === "string" && value.trim()) as string | undefined ?? "";
export function buyerProducts(payload: unknown): Product[] {
  const root = record(payload);
  if (root.success === false) throw new Error(text(root.error, root.message) || "Products could not be loaded.");
  const data = root.data ?? payload;
  const rows = Array.isArray(data) ? data : record(data).products ?? record(data).items;
  if (!Array.isArray(rows)) throw new Error("Products could not be loaded. Please try again.");
  return rows.flatMap(input => {
    const value = record(input);
    const id = text(value.id, value.product_id, value.uuid);
    const status = text(value.status).toLowerCase();
    if (!id || ["draft", "rejected", "archived", "inactive", "pending", "pending_review"].includes(status)) return [];
    const rawPrice = value.base_price ?? value.basePrice ?? value.price;
    const price = rawPrice !== null && rawPrice !== undefined && rawPrice !== "" ? Number(rawPrice) : NaN;
    const rawStock = value.stock ?? value.quantity ?? value.available_quantity;
    const stock = rawStock !== undefined && rawStock !== null && rawStock !== "" && Number.isInteger(Number(rawStock)) && Number(rawStock) >= 0 ? Number(rawStock) : null;
    const seller = record(value.seller);
    const media = record(value.media);
    const images = Array.isArray(media.images) ? media.images.filter(image => typeof image === "string" || Object.keys(record(image)).length).map(image => productImage({ media: { cover: image } })) : [];
    const category = typeof value.category === "string" ? value.category : text(record(value.category).name, value.category_name);
    return [{ id, title: text(value.name, value.title) || "Untitled product", price: Number.isFinite(price) && price >= 0 ? String(price) : "", image: productImage(value), images, rating: text(value.rating, value.average_rating), reviews: String(value.review_count ?? value.reviews_count ?? 0), description: text(value.shortDescription, value.short_description, value.description) || "The seller hasn't added a description yet.", seller: { name: text(seller.name, value.seller_name) || "Marketplace seller", slug: text(seller.slug, value.seller_slug) }, category, stock, condition: text(value.condition), preview: false } satisfies Product];
  });
}
export function shoppingCategory(product: Product) {
  const value = `${product.category ?? ""} ${product.title}`.toLowerCase();
  if (/sneaker|fashion|shoe|watch|backpack|bag|shirt|dress|wear|style/.test(value)) return "Style";
  if (/serum|skin|beauty|cosmetic/.test(value)) return "Beauty";
  if (/home|furniture|lamp|chair|sofa|kitchen|living|decor/.test(value)) return "Home & living";
  if (/audio|headphone|tech|wireless|monitor|digital|computer|speaker|mixer|recorder|microphone|controller|system/.test(value)) return "Electronics";
  return product.category || "Discover";
}
export function canShop(product: Product) { return !product.preview && product.stock !== 0 && product.price.trim() !== "" && Number.isFinite(Number(product.price)) && Number(product.price) > 0; }
