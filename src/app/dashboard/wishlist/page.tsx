"use client";
import { useState } from "react";
import Link from "next/link";
import { useSavedProducts } from "@/components/commerce/savedProducts";
import { useCartCount } from "@/components/commerce/store";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import CartAddedModal from "@/components/commerce/CartAddedModal";
import BuyerProductCard from "@/components/dashboard/BuyerProductCard";
import styles from "@/components/dashboard/buyerHome.module.css";
export default function WishlistPage() {
  const { products } = useSavedProducts();
  const count = useCartCount();
  const [added, setAdded] = useState("");
  return <div className={styles.dashboard}><header className={styles.heading}><div><span className={styles.eyebrow}>THE ONES YOU HAVE YOUR EYE ON</span><h1>Saved for a little later.</h1><p>Your favourites, saved on this device for your account.</p></div><Link href="/dashboard/home#buyer-finds" className={styles.outlineButton}>Discover more<ShopperIcon name="arrow" size={16} /></Link></header>{products.length ? <div className={styles.productGrid}>{products.map(product => <BuyerProductCard key={product.id} product={product} onAdd={item => setAdded(item.title)} />)}</div> : <div className={styles.noResults}><ShopperIcon name="heart" size={31} /><h3>Make room for your favourites.</h3><p>Tap the heart on a product to keep it here for later.</p><Link className={styles.primaryButton} href="/dashboard/home#buyer-finds">Find something you love<ShopperIcon name="arrow" size={16} /></Link></div>}<CartAddedModal open={!!added} onClose={() => setAdded("")} productName={added} cartCount={count} /></div>;
}
