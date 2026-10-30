"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { useBuyerOrders } from "@/components/commerce/buyerOrders";
import { useSavedProducts } from "@/components/commerce/savedProducts";
import { useCart, cartSubtotal, formatCurrency, useCartCount, parsePrice } from "@/components/commerce/store";
import CartAddedModal from "@/components/commerce/CartAddedModal";
import { extendedCatalog, type Product } from "@/components/products/catalog";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import BuyerProductCard from "./BuyerProductCard";
import { buyerProducts, shoppingCategory } from "./buyerCatalog";
import styles from "./buyerHome.module.css";

const collections = [
  { name: "Electronics", caption: "A little more connected.", image: "/buyer/buyer-tech.jpg", className: "tech" },
  { name: "Style", caption: "Find your everyday favourite.", image: "/buyer/buyer-style.jpg", className: "style" },
  { name: "Home & living", caption: "Make room for something good.", image: "/buyer/buyer-home.jpg", className: "living" },
];
const inactive = new Set(["delivered", "confirmed", "completed", "cancelled", "returned", "failed", "failed_delivery"]);

export default function HomeScreen({ userName }: { userName: string }) {
  const user = useAuthUser();
  const cart = useCart(), cartCount = useCartCount();
  const saved = useSavedProducts();
  const { orders, loading: ordersLoading, error: ordersError, reload: reloadOrders } = useBuyerOrders();
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [revision, setRevision] = useState(0);
  const [category, setCategory] = useState("All finds");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");
  const [limit, setLimit] = useState(8);
  const [added, setAdded] = useState("");
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search);
    setSearch(initial.get("q") || "");
    if (initial.get("category")) setCategory(initial.get("category")!);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setCatalogError("");
    async function load() {
      try {
        const response = await fetch("/api/products/public?limit=100&offset=0", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("We couldn't load the latest listings. Please try again.");
        const items = buyerProducts(await response.json());
        if (!controller.signal.aborted) setCatalog(items);
      } catch (error) { if (!controller.signal.aborted) { setCatalog([]); setCatalogError(error instanceof Error ? error.message : "Products could not be loaded."); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [revision]);
  const previews = !catalog.length;
  const products = useMemo(() => previews ? extendedCatalog.map(item => ({ ...item, preview: true })) : catalog, [catalog, previews]);
  const categories = useMemo(() => ["All finds", ...Array.from(new Set(products.map(shoppingCategory)))], [products]);
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    const values = products.filter(product => (category === "All finds" || shoppingCategory(product) === category) && (!query || `${product.title} ${product.seller.name} ${product.category ?? ""}`.toLowerCase().includes(query)));
    if (sort !== "featured") values.sort((a, b) => (parsePrice(a.price) - parsePrice(b.price)) * (sort === "price-up" ? 1 : -1));
    return values;
  }, [products, category, search, sort]);
  const activeOrders = orders.filter(order => !inactive.has(order.status));
  const recent = [...orders].sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)).slice(0, 2);
  function chooseCategory(value: string) { setCategory(value); setLimit(8); document.getElementById("buyer-finds")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  const firstName = userName && userName !== "My Account" ? userName.split(/\s+/)[0] : "there";

  return <div className={styles.dashboard}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>YOUR LITTLE CORNER OF ALPHA</span><h1>Welcome back, {firstName}<span className={styles.greetingDot}>.</span></h1><p>Good finds, favourite things, and everything on its way to you.</p></div><Link className={styles.outlineButton} href="/dashboard/orders"><ShopperIcon name="orders" size={17} />My orders<ShopperIcon name="arrow" size={15} /></Link></header>
    <section className={styles.quickStats} aria-label="Your shopping at a glance">
      <Link href="/dashboard/orders" className={styles.stat}><span className={`${styles.statIcon} ${styles.blue}`}><ShopperIcon name="truck" size={21} /></span><div><span>Active orders</span><strong>{!user ? "Sign in to view" : ordersLoading ? "Loading..." : ordersError ? "View your orders" : activeOrders.length}<small>{!user || ordersError || ordersLoading ? "Your orders, all in one place" : "From your 100 most recent orders"}</small></strong></div><ShopperIcon name="arrow" size={16} /></Link>
      <Link href="/dashboard/wishlist" className={styles.stat}><span className={`${styles.statIcon} ${styles.rose}`}><ShopperIcon name="heart" size={21} /></span><div><span>Saved for later</span><strong>{saved.products.length}<small>Your favourites on this device</small></strong></div><ShopperIcon name="arrow" size={16} /></Link>
      <Link href="/dashboard/cart" className={styles.stat}><span className={`${styles.statIcon} ${styles.amber}`}><ShopperIcon name="cart" size={21} /></span><div><span>Your shopping bag</span><strong>{cartCount} {cartCount === 1 ? "item" : "items"}<small>{cartCount ? `${formatCurrency(cartSubtotal(cart))} subtotal` : "A good find is just a browse away"}</small></strong></div><ShopperIcon name="arrow" size={16} /></Link>
    </section>
    <div className={styles.featureGrid}>
      <section className={styles.hero}><div className={styles.heroCopy}><span className={styles.heroLabel}><span />THE EVERYDAY EDIT</span><h2>Good finds.<br /><em>Great days.</em></h2><p>Discover little upgrades for your style, your space, and your everyday.</p><a className={styles.primaryButton} href="#buyer-finds">Find your next favourite<ShopperIcon name="arrow" size={17} /></a><span className={styles.heroFootnote}>Explore the marketplace. Make it yours.</span></div><div className={styles.heroVisual}><img src="/buyer/buyer-style.jpg" alt="Red everyday sneakers from the style collection" width={600} height={600} fetchPriority="high" /><div className={styles.heroProduct}><span>IN THE COLLECTION</span><strong>Everyday, with a little extra.</strong><button type="button" onClick={() => chooseCategory("Style")} aria-label="Explore style collection"><ShopperIcon name="arrow" size={19} /></button></div></div></section>
      <section className={styles.orderPanel}><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ALL IN ONE PLACE</span><h2>Your orders</h2></div><ShopperIcon name="orders" size={20} /></div>{ordersLoading && user ? <div className={styles.orderEmpty}><span className={styles.skeleton} /><p>Checking your latest orders...</p></div> : ordersError && user ? <div className={styles.orderEmpty}><ShopperIcon name="orders" size={27} /><strong>Let's check that again.</strong><p>Your order activity couldn't be loaded.</p><button className={styles.textButton} onClick={reloadOrders}>Refresh orders<ShopperIcon name="arrow" size={14} /></button></div> : recent.length ? <div className={styles.orderList}>{recent.map(order => <Link key={order.id} href={`/dashboard/orders/${encodeURIComponent(order.id)}`}><span className={styles.orderParcel}><ShopperIcon name="orders" size={20} /></span><div><strong>{order.items[0]?.name || order.vendor}</strong><small>#{order.id.slice(-8).toUpperCase()} · {order.status.replaceAll("_", " ")}</small><span className={styles.orderPayment}>{order.paymentStatus === "paid" ? "Payment received" : `Payment ${order.paymentStatus.replaceAll("_", " ")}`}</span></div><ShopperIcon name="arrow" size={15} /></Link>)}</div> : <div className={styles.orderEmpty}><span className={styles.emptyIllustration}><ShopperIcon name="orders" size={31} /></span><strong>{user ? "Your next good find awaits." : "Make yourself at home."}</strong><p>{user ? "Once you place an order, follow its journey right here." : "Sign in to keep your orders and shopping together."}</p><Link href={user ? "#buyer-finds" : "/login/user"}>{user ? "Start exploring" : "Sign in"}<ShopperIcon name="arrow" size={14} /></Link></div>}<Link className={styles.orderFooter} href="/dashboard/orders">View all orders<ShopperIcon name="arrow" size={14} /></Link></section>
    </div>
    <section className={styles.collections}><div className={styles.sectionHeading}><div><h2>Something for every part of your day</h2><p>A few good places to start.</p></div></div><div className={styles.collectionGrid}>{collections.map(collection => <button key={collection.name} type="button" className={`${styles.collection} ${styles[collection.className]}`} onClick={() => chooseCategory(collection.name)}><img src={collection.image} alt="" width={500} height={320} loading="lazy" decoding="async" /><span><small>{collection.caption}</small><strong>{collection.name}<ShopperIcon name="arrow" size={18} /></strong></span></button>)}</div></section>
    <section className={styles.browse} id="buyer-finds"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>A LITTLE DISCOVERY GOES A LONG WAY</span><h2>{previews ? "Explore the collection" : "Find something you'll love"}</h2><p>{previews ? "A look at the collection while new seller listings arrive. Preview items aren't available to buy." : "Browse the latest marketplace listings, all in one place."}</p></div><span className={styles.resultCount}>{filtered.length} {previews ? "previews" : "finds"}</span></div><div className={styles.browseTools}><label className={styles.search}><ShopperIcon name="search" size={18} /><input value={search} onChange={event => { setSearch(event.target.value); setLimit(8); }} placeholder="Find something you love..." aria-label="Search your finds" />{search ? <button type="button" aria-label="Clear product search" onClick={() => setSearch("")}><ShopperIcon name="close" size={15} /></button> : null}</label><label className={styles.sort}>Sort by<select aria-label="Sort products" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-up">Price: low to high</option><option value="price-down">Price: high to low</option></select></label></div><div className={styles.categoryFilters} role="group" aria-label="Product collections">{categories.map(name => <button type="button" key={name} aria-pressed={category === name} className={category === name ? styles.filterActive : ""} onClick={() => { setCategory(name); setLimit(8); }}>{name}</button>)}</div>
      {catalogError ? <div className={styles.catalogNotice} role="alert"><span>{catalogError} Collection previews are shown below.</span><button onClick={() => setRevision(value => value + 1)} disabled={loading}>Try again</button></div> : null}
      {loading ? <div className={styles.productGrid} aria-label="Loading products">{Array.from({ length: 4 }, (_, index) => <div key={index} className={styles.productSkeleton}><div /><span /><span /></div>)}</div> : filtered.length ? <div className={styles.productGrid}>{filtered.slice(0, limit).map(product => <BuyerProductCard key={product.id} product={product} onAdd={item => setAdded(item.title)} />)}</div> : <div className={styles.noResults}><ShopperIcon name="search" size={29} /><h3>No finds just yet.</h3><p>Try a different search or explore another collection.</p><button onClick={() => { setSearch(""); setCategory("All finds"); }}>Explore all finds<ShopperIcon name="arrow" size={15} /></button></div>}
      {!loading && filtered.length > limit ? <button className={styles.loadMore} onClick={() => setLimit(value => value + 8)}>Discover more<ShopperIcon name="plus" size={16} /></button> : null}
    </section>
    <section className={styles.confidence}><span className={styles.confidenceIcon}><ShopperIcon name="shield" size={29} /></span><div><span className={styles.eyebrow}>A LITTLE MORE PEACE OF MIND</span><h2>Good shopping starts with confidence.</h2><p>Pay through Alpha Marketplace, follow your order, and confirm receipt when your delivery arrives.</p></div><Link href="/dashboard/support">We're here to help<ShopperIcon name="arrow" size={16} /></Link></section>
    <footer className={styles.footer}><span>Alpha Marketplace · Find your everyday.</span><Link href="/dashboard/support">Help & support<ShopperIcon name="arrow" size={13} /></Link></footer>
    <CartAddedModal open={!!added} productName={added} cartCount={cartCount} onClose={() => setAdded("")} />
  </div>;
}
