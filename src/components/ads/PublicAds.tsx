"use client";
import Link from "next/link";
import { useState } from "react";
import MarketplaceHeaderNext from "@/components/marketplace/MarketplaceHeaderNext";
import ProductThumbnail from "@/components/products/ProductThumbnail";
import { productImage } from "@/components/products/productMedia";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { isSellerRole } from "@/components/auth/authStorage";
import { useAdsDirectory, useAdsResource } from "./hooks";
import { adRecord, hierarchyLabel, label, money, record, text, type AdRecord } from "./data";
import { collection, Feedback, Pager } from "./Common";
import styles from "./ads.module.css";

function AdCard({ item }: { item: AdRecord }) {
  return <Link className={styles.card} href={`/ads/${encodeURIComponent(text(item.id))}`}><div className={styles.photo}><ProductThumbnail image={productImage(item, "")} /></div>{item.is_promoted ? <span className={styles.badge}>{label(item.promotion_type ?? record(item.promotion).type) || "Promoted"}</span> : null}<h2>{text(item.name, "Ad")}</h2><p className={styles.price}>{money(item.final_price ?? item.base_price ?? item.basePrice)}</p><p className={styles.muted}>{text(record(item.category).name)}{record(item.location).name ? ` · ${text(record(item.location).name)}` : ""}</p></Link>;
}
export default function PublicAds() {
  const user = useAuthUser();
  const categories = useAdsDirectory("/api/ads/categories"), locations = useAdsDirectory("/api/ads/locations");
  const [filters, setFilters] = useState({ search: "", category_id: "", location_id: "", promotion: "", min_price: "", max_price: "", sort: "relevance" });
  const [offset, setOffset] = useState(0);
  const query = new URLSearchParams({ limit: "20", offset: String(offset) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const resource = useAdsResource(`/api/ads?${query}`, false), list = collection(resource.data);
  const promotedQuery = new URLSearchParams({ limit: "6", offset: "0" });
  if (filters.category_id) promotedQuery.set("category_id", filters.category_id);
  if (filters.location_id) promotedQuery.set("location_id", filters.location_id);
  if (filters.promotion) promotedQuery.set("type", filters.promotion);
  const promoted = useAdsResource(`/api/ads/promoted?${promotedQuery}`, false), featured = collection(promoted.data);
  function change(key: keyof typeof filters, value: string) { setOffset(0); setFilters(previous => ({ ...previous, [key]: value })); }
  return <><MarketplaceHeaderNext /><main className={styles.page}><header className={styles.header}><div><h1>Marketplace Ads</h1><p className={styles.muted}>Browse approved listings from buyers and sellers.</p></div><Link className={`${styles.button} ${styles.primary}`} href={user ? isSellerRole(user.role) ? "/vendor/my-ads/create" : "/dashboard/my-ads/create" : "/login"}>Post an ad</Link></header>
    <section className={styles.card}><div className={styles.filters}><label>Search<input value={filters.search} onChange={event => change("search", event.target.value)} placeholder="What are you looking for?" /></label><label>Category<select value={filters.category_id} onChange={event => change("category_id", event.target.value)}><option value="">All categories</option>{categories.data?.map(item => <option key={text(item.id)} value={text(item.id)}>{text(item.name)}</option>)}</select></label><label>Location<select value={filters.location_id} onChange={event => change("location_id", event.target.value)}><option value="">All locations</option>{locations.data?.map(item => <option key={text(item.id)} value={text(item.id)}>{hierarchyLabel(item, locations.data || [])}</option>)}</select></label><label>Promotion<select value={filters.promotion} onChange={event => change("promotion", event.target.value)}><option value="">All ads</option>{["featured", "premium", "vip"].map(type => <option key={type} value={type}>{label(type)}</option>)}</select></label><label>Minimum price<input type="number" min={0} value={filters.min_price} onChange={event => change("min_price", event.target.value)} /></label><label>Maximum price<input type="number" min={0} value={filters.max_price} onChange={event => change("max_price", event.target.value)} /></label><label>Sort<select value={filters.sort} onChange={event => change("sort", event.target.value)}><option value="relevance">Recommended</option><option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label></div><Feedback error={categories.error || locations.error} /></section>
    {!filters.search && featured.items.length ? <section><h2>Promoted ads</h2><div className={styles.grid}>{featured.items.map(item => <AdCard key={text(item.id)} item={item} />)}</div></section> : null}<Feedback error={promoted.error || featured.error} />
    <section><h2>Browse ads</h2><Feedback error={resource.error || list.error} />{resource.loading ? <p role="status">Loading ads…</p> : list.items.length ? <div className={styles.grid}>{list.items.map(item => <AdCard key={text(item.id)} item={item} />)}</div> : !resource.error && !list.error ? <p className={styles.empty}>No approved ads match these filters.</p> : null}<Pager offset={offset} count={list.items.length} total={list.total} onPage={setOffset} /></section>
  </main></>;
}
export function PublicAdDetail({ id }: { id: string }) {
  const resource = useAdsResource(`/api/ads/${encodeURIComponent(id)}`, false), item = adRecord(resource.data);
  return <><MarketplaceHeaderNext /><main className={styles.page}><Link href="/ads">← Browse ads</Link><Feedback error={resource.error} />{resource.loading ? <p role="status">Loading ad…</p> : item.id ? <article className={styles.card}><h1>{text(item.name)}</h1>{item.is_promoted ? <span className={styles.badge}>{label(item.promotion_type) || "Promoted"}</span> : null}<div className={styles.details}><div className={styles.photo} style={{ height: 360 }}><ProductThumbnail image={productImage(item, "")} /></div><div><p className={styles.price}>{money(item.final_price ?? item.base_price)}</p><p>{text(item.description ?? item.shortDescription)}</p><p className={styles.muted}>{text(record(item.category).name)} · {text(record(item.location).name)}</p><div className={styles.actions}><Link className={`${styles.button} ${styles.primary}`} href={`/products/${encodeURIComponent(id)}`}>View product and buying options</Link></div></div></div></article> : !resource.error ? <p>This ad is unavailable.</p> : null}</main></>;
}
