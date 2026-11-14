"use client";
import Link from "next/link";
import { useState } from "react";
import { useAdsDirectory, useAdsResource } from "./hooks";
import { date, hierarchyLabel, label, money, record, statusOf, statuses, text, unwrap } from "./data";
import { collection, Feedback, Pager } from "./Common";
import styles from "./ads.module.css";

export default function AdsList({ admin = false, basePath }: { admin?: boolean; basePath: string }) {
  const [filters, setFilters] = useState({ status: admin ? "pending" : "", search: "", owner_id: "", poster_role: "", category_id: "", location_id: "", promoted: "", include_deleted: "" });
  const [offset, setOffset] = useState(0);
  const categories = useAdsDirectory("/api/ads/categories");
  const locations = useAdsDirectory("/api/ads/locations");
  const query = new URLSearchParams({ limit: "20", offset: String(offset) });
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  const resource = useAdsResource(`${admin ? "/api/admin/ads" : "/api/my-ads"}?${query}`);
  const stats = useAdsResource(admin ? "/api/admin/ads/stats" : "");
  const list = collection(resource.data);
  function change(key: keyof typeof filters, value: string) { setOffset(0); setFilters(previous => ({ ...previous, [key]: value })); }
  const counts = record(record(unwrap(stats.data)).ads ?? record(unwrap(stats.data)).moderation ?? unwrap(stats.data));
  return <div className={styles.page}>
    <header className={styles.header}><div><h1>{admin ? "Admin Ads" : "My Ads"}</h1><p className={styles.muted}>{admin ? "Review buyer and seller listings, publish approved ads, and record moderation decisions." : "Manage your listings, review feedback, and promote approved ads."}</p></div><div className={styles.actions}>{admin ? <><Link className={styles.button} href="/admin/ads/fees">Posting fees</Link><Link className={styles.button} href="/admin/ads/history">Audit history</Link></> : <Link className={`${styles.button} ${styles.primary}`} href={`${basePath}/create`}>Post an ad</Link>}<button onClick={resource.refresh}>Refresh</button></div></header>
    {admin && stats.data ? <div className={styles.grid}>{statuses.map(status => <div className={styles.card} key={status}><span className={styles.badge}>{label(status)}</span><p className={styles.price}>{text(counts[status], "—")}</p></div>)}</div> : null}
    <section className={styles.card}>
      <div className={styles.filters}>
        <label>Status<select value={filters.status} onChange={event => change("status", event.target.value)}><option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label>
        {admin ? <><label>Search<input value={filters.search} onChange={event => change("search", event.target.value)} placeholder="Title or description" /></label><label>Poster role<select value={filters.poster_role} onChange={event => change("poster_role", event.target.value)}><option value="">Buyers and sellers</option><option value="buyer">Buyer</option><option value="seller">Seller</option></select></label><label>Owner ID<input value={filters.owner_id} onChange={event => change("owner_id", event.target.value)} /></label><label>Category<select value={filters.category_id} onChange={event => change("category_id", event.target.value)}><option value="">All categories</option>{categories.data?.map(item => <option key={text(item.id)} value={text(item.id)}>{text(item.name)}</option>)}</select></label><label>Location<select value={filters.location_id} onChange={event => change("location_id", event.target.value)}><option value="">All locations</option>{locations.data?.map(item => <option key={text(item.id)} value={text(item.id)}>{hierarchyLabel(item, locations.data || [])}</option>)}</select></label><label className={styles.check}><input type="checkbox" checked={filters.promoted === "true"} onChange={event => change("promoted", event.target.checked ? "true" : "")} />Promoted only</label><label className={styles.check}><input type="checkbox" checked={filters.include_deleted === "true"} onChange={event => change("include_deleted", event.target.checked ? "true" : "")} />Include deleted</label></> : null}
      </div>
      <Feedback error={resource.error || list.error || (admin ? categories.error || locations.error : "")} />
      {resource.loading ? <p role="status">Loading ads…</p> : list.items.length ? <div className={styles.table}><table><thead><tr><th>Ad</th><th>Price</th><th>Status</th>{admin ? <th>Poster</th> : null}<th>Updated</th><th /></tr></thead><tbody>{list.items.map(item => <tr key={text(item.id)}><td><strong>{text(item.name, "Untitled ad")}</strong><p className={styles.muted}>{text(record(item.category).name)}</p>{item.is_promoted ? <span className={styles.badge}>Promoted</span> : null}{item.deleted_at ? <span className={styles.badge}>Deleted</span> : null}</td><td>{money(item.base_price ?? item.basePrice)}</td><td><span className={styles.badge}>{label(statusOf(item)) || "Status unavailable"}</span></td>{admin ? <td>{text(item.poster_role)}<p className={styles.muted}>{text(item.owner_id ?? item.seller_id)}</p></td> : null}<td>{date(item.updated_at ?? item.created_at)}</td><td><Link href={`${basePath}/${encodeURIComponent(text(item.id))}`}>{admin ? "Review" : "Manage"}</Link></td></tr>)}</tbody></table></div> : !resource.error && !list.error ? <p className={styles.empty}>No ads match this view.</p> : null}
      <Pager offset={offset} count={list.items.length} total={list.total} onPage={setOffset} />
    </section>
  </div>;
}
