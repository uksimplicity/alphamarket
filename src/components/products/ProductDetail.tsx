"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { addToCart, formatCurrency, parsePrice, useCartCount } from "@/components/commerce/store";
import { useSavedProducts } from "@/components/commerce/savedProducts";
import { extendedCatalog, type Product } from "@/components/products/catalog";
import { getStoreProfileBySlug, subscribeStoreProfiles } from "@/components/store/storeProfileClient";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import BuyerProductCard from "@/components/dashboard/BuyerProductCard";
import { canShop, shoppingCategory } from "@/components/dashboard/buyerCatalog";
import CartAddedModal from "@/components/commerce/CartAddedModal";
import styles from "./productDetail.module.css";

export default function ProductDetail({ product, backLink }: { product: Product; backLink?: ReactNode }) {
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [cartModalName, setCartModalName] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [store, setStore] = useState<ReturnType<typeof getStoreProfileBySlug>>(null);
  const saved = useSavedProducts(), cartCount = useCartCount();
  const zoom = useRef<HTMLDialogElement>(null), chat = useRef<HTMLDialogElement>(null);
  const images = useMemo(() => [...new Set([product.image, ...(product.images ?? [])].filter(Boolean))], [product.image, product.images]);
  const price = parsePrice(product.price), oldPrice = product.oldPrice ? parsePrice(product.oldPrice) : null;
  const purchasable = canShop(product), selected = saved.products.some(item => item.id === product.id);
  const sellerName = store?.name || product.seller.name;
  const related = extendedCatalog.filter(item => item.id !== product.id).sort((a,b) => Number(shoppingCategory(b) === shoppingCategory(product)) - Number(shoppingCategory(a) === shoppingCategory(product))).slice(0, 4);
  useEffect(() => {
    const update = () => setStore(getStoreProfileBySlug(product.seller.slug));
    update(); return subscribeStoreProfiles(update);
  }, [product.seller.slug]);
  useEffect(() => { setQuantity(1); setActiveImage(0); setShareMessage(""); }, [product.id]);
  function toggleSaved() { try { saved.toggle(product); setSaveError(""); } catch (failure) { setSaveError(failure instanceof Error ? failure.message : "This item couldn't be saved."); } }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: product.title, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setShareMessage("Product link copied."); }
    } catch (failure) { if (!(failure instanceof DOMException && failure.name === "AbortError")) setShareMessage("Couldn't share the link. You can copy it from your address bar."); }
  }
  function add() { if (!purchasable) return; addToCart({ id: product.id, name: product.title, price, image: product.image }, quantity); setCartModalName(product.title); }

  return <main className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Breadcrumb"><Link href="/dashboard/home">Marketplace</Link><span>/</span><Link href={`/dashboard/home?category=${encodeURIComponent(shoppingCategory(product))}#buyer-finds`}>{shoppingCategory(product)}</Link><span>/</span><span>{product.title}</span></nav>
    <div className={styles.productLayout}>
      <section className={styles.gallery} aria-label="Product images"><button type="button" className={styles.mainImage} onClick={() => zoom.current?.showModal()} aria-label={`Enlarge image of ${product.title}`}><img src={images[activeImage] || product.image} alt={product.title} width={850} height={850} fetchPriority="high" decoding="async" /><span><ShopperIcon name="search" size={16} />Take a closer look</span></button>{images.length > 1 ? <div className={styles.thumbnails}>{images.map((image,index) => <button type="button" key={image} aria-label={`View product image ${index + 1}`} aria-pressed={activeImage === index} onClick={() => setActiveImage(index)}><img src={image} alt="" width={75} height={75} loading="lazy" /></button>)}</div> : null}<div className={styles.galleryNote}><ShopperIcon name="shield" size={18} /><span>Keep your purchase and payment together on Alpha Marketplace.</span></div></section>
      <section className={styles.purchase}><div className={styles.productTop}><span className={styles.eyebrow}>{shoppingCategory(product)}</span><div><button type="button" aria-label={selected ? "Remove from saved items" : "Save product"} aria-pressed={selected} className={selected ? styles.saved : ""} onClick={toggleSaved}><ShopperIcon name="heart" size={19} /></button><button type="button" aria-label="Share product" onClick={() => void share()}><ShopperIcon name="share" size={18} /></button></div></div><h1>{product.title}</h1><p className={styles.shortDescription}>{product.description}</p>{!product.preview && Number(product.rating) > 0 && Number(product.reviews) > 0 ? <div className={styles.rating}><ShopperIcon name="star" size={15} /><strong>{product.rating}</strong><span>({product.reviews} reviews)</span></div> : null}<div className={styles.priceRow}><strong>{product.price.trim() ? formatCurrency(price) : "Price unavailable"}</strong>{oldPrice && oldPrice > price ? <><del>{formatCurrency(oldPrice)}</del><span>Save {Math.round((1 - price / oldPrice) * 100)}%</span></> : null}</div><div className={styles.availability}><i data-state={product.preview ? "preview" : product.stock === 0 ? "empty" : "available"} />{product.preview ? "Collection preview" : product.stock === 0 ? "Currently sold out" : product.stock !== null && product.stock !== undefined ? `${product.stock} available` : "Availability confirmed at checkout"}</div>
        {product.preview ? <div className={styles.previewNote}>You're exploring a collection preview. This item isn't available to purchase yet. Browse the marketplace for available seller listings.</div> : null}
        <div className={styles.buyRow}><div className={styles.quantity} aria-label="Choose quantity"><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity(value => Math.max(1,value - 1))} disabled={!purchasable || quantity <= 1}><ShopperIcon name="minus" size={15} /></button><span aria-live="polite">{quantity}</span><button type="button" aria-label="Increase quantity" onClick={() => setQuantity(value => Math.min(product.stock ?? 99, value + 1))} disabled={!purchasable || quantity >= (product.stock ?? 99)}><ShopperIcon name="plus" size={15} /></button></div><button type="button" className={styles.addButton} disabled={!purchasable} onClick={add}><ShopperIcon name="cart" size={19} />{product.preview ? "Preview item" : product.stock === 0 ? "Sold out" : "Add to bag"}</button></div>{product.preview ? <Link href="/dashboard/home#buyer-finds" className={styles.browseLink}>Explore the marketplace<ShopperIcon name="arrow" size={15} /></Link> : null}<div aria-live="polite" className={styles.feedback}>{shareMessage || saveError}</div>
        <div className={styles.seller}><span className={styles.sellerAvatar}>{store?.logoFallbackDataUrl || store?.logoUrl ? <img src={store.logoFallbackDataUrl || store.logoUrl} alt="" width={42} height={42} /> : sellerName.split(/\s+/).slice(0,2).map(item => item[0]).join("")}</span><div><small>{product.preview ? "COLLECTION SELLER" : "SOLD BY"}</small><strong>{sellerName}</strong>{store?.location ? <span>{store.location}</span> : null}</div>{product.seller.slug ? <Link href={`/store/${encodeURIComponent(product.seller.slug)}`}>Visit store<ShopperIcon name="arrow" size={14} /></Link> : null}</div><button type="button" className={styles.chatButton} onClick={() => chat.current?.showModal()}><ShopperIcon name="chat" size={18} />Ask the seller a question<ShopperIcon name="arrow" size={15} /></button>
        <div className={styles.serviceNotes}><div><span><ShopperIcon name="truck" size={19} /></span><div><strong>Delivery, without the guesswork.</strong><p>Review delivery details and your total before payment.</p></div></div><div><span><ShopperIcon name="shield" size={19} /></span><div><strong>Keep your payment on Alpha.</strong><p>Track your order and confirm receipt when it arrives.</p></div></div></div>
      </section>
    </div>
    <section className={styles.details}><div><span className={styles.eyebrow}>THE FINER DETAILS</span><h2>A closer look.</h2><p>The details that help you choose.</p></div><div className={styles.accordions}><details open><summary>About this product<ShopperIcon name="plus" size={17} /></summary><p>{product.description}</p>{product.condition ? <p><strong>Condition:</strong> {product.condition}</p> : null}{product.category ? <p><strong>Category:</strong> {product.category}</p> : null}</details><details><summary>Delivery & order updates<ShopperIcon name="plus" size={17} /></summary><p>Enter your delivery address at checkout to review your order details. After placing an order, follow its status in My orders. Delivery timing depends on the seller and your location.</p><Link href="/dashboard/orders">Go to My orders<ShopperIcon name="arrow" size={14} /></Link></details><details><summary>Payments & support<ShopperIcon name="plus" size={17} /></summary><p>Complete payment through Alpha Marketplace. Confirm receipt only after your delivery arrives. If you need help with your order or payment, contact support.</p><Link href="/dashboard/support">Get support<ShopperIcon name="arrow" size={14} /></Link></details></div></section>
    <section className={styles.related}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>KEEP A GOOD THING GOING</span><h2>A few more to explore.</h2></div><Link href="/dashboard/home#buyer-finds">Discover more<ShopperIcon name="arrow" size={16} /></Link></div><div className={styles.relatedGrid}>{related.map(item => <BuyerProductCard key={item.id} product={{ ...item, preview: true }} />)}</div></section>
    <div className={styles.bottomNote}>{backLink}<span>Alpha Marketplace · Find your everyday.</span></div>
    <dialog className={styles.zoomDialog} ref={zoom} aria-label={`Enlarged image of ${product.title}`} onClick={event => { if (event.currentTarget === event.target) zoom.current?.close(); }}><button type="button" aria-label="Close enlarged image" onClick={() => zoom.current?.close()}><ShopperIcon name="close" size={22} /></button><img src={images[activeImage] || product.image} alt={product.title} /></dialog>
    <dialog className={styles.chatDialog} ref={chat} aria-labelledby="seller-chat-title"><span className={styles.chatMark}><ShopperIcon name="chat" size={28} /></span><h2 id="seller-chat-title">A question for {sellerName}?</h2><p>Seller messaging isn't available yet. Your messages won't be sent until chat is connected.</p><p>For help with an existing purchase, please contact marketplace support.</p><div><button type="button" onClick={() => chat.current?.close()}>Continue browsing</button><Link href="/dashboard/support">Contact support<ShopperIcon name="arrow" size={15} /></Link></div></dialog>
    <CartAddedModal open={!!cartModalName} onClose={() => setCartModalName("")} productName={cartModalName} cartCount={cartCount} />
  </main>;
}
