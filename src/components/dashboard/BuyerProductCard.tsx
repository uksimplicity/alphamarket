"use client";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/components/products/catalog";
import { addToCart, formatCurrency, parsePrice } from "@/components/commerce/store";
import { useSavedProducts } from "@/components/commerce/savedProducts";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import { canShop, shoppingCategory } from "./buyerCatalog";
import styles from "./buyerHome.module.css";
import { marketplaceImage } from "@/components/products/productMedia";

export default function BuyerProductCard({ product, onAdd }: { product: Product; onAdd?: (product: Product) => void }) {
  const { products: saved, toggle } = useSavedProducts();
  const [error, setError] = useState("");
  const selected = saved.some(item => item.id === product.id);
  const href = `/products/${encodeURIComponent(product.id)}`;
  return <article className={styles.productCard}>
    <div className={styles.productVisual}><Link href={href} tabIndex={-1} aria-hidden="true"><img src={marketplaceImage(product.image)} alt="" loading="lazy" decoding="async" width={380} height={380} /></Link>{product.preview ? <span className={styles.productTag}>Collection preview</span> : product.stock === 0 ? <span className={styles.productTag}>Sold out</span> : null}<button type="button" className={`${styles.saveButton} ${selected ? styles.saved : ""}`} aria-label={`${selected ? "Unsave" : "Save"} ${product.title}`} aria-pressed={selected} onClick={() => { try { toggle(product); setError(""); } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save item."); } }}><ShopperIcon name="heart" size={18} /></button></div>
    <div className={styles.productInfo}><span className={styles.productCategory}>{shoppingCategory(product)}</span><Link href={href} className={styles.productTitle}>{product.title}</Link><span className={styles.productSeller}>{product.seller.name}</span><div className={styles.productBottom}><strong>{product.price.trim() ? formatCurrency(parsePrice(product.price)) : "Price unavailable"}</strong>{canShop(product) ? <button type="button" aria-label={`Add ${product.title} to cart`} onClick={() => { addToCart({ id: product.id, name: product.title, price: parsePrice(product.price), image: product.image }); onAdd?.(product); }}><ShopperIcon name="plus" size={17} /></button> : <Link className={styles.viewProduct} href={href}>Explore <ShopperIcon name="arrow" size={14} /></Link>}</div>{error ? <p role="alert" className={styles.errorText}>{error}</p> : null}</div>
  </article>;
}
