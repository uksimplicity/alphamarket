import type { Product } from "@/components/products/catalog";

export type SellerIdentity = { id: string; name: string; role?: string };
export function needsSellerName(seller: Product["seller"]) {
  return Boolean(seller.id?.trim()) && (!seller.name.trim() || seller.name.trim().toLowerCase() === "marketplace seller");
}
export function resolveSellerName(seller: Product["seller"], directory: SellerIdentity[] = []) {
  if (!needsSellerName(seller)) return seller.name.trim() || "Marketplace seller";
  const match = directory.find(account => account.id === seller.id && (!account.role || account.role === "seller"));
  return match?.name.trim() || seller.name.trim() || "Marketplace seller";
}
