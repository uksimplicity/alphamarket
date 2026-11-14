"use client";
import Link from "next/link";
import { useState } from "react";
import { useAdsResource } from "./hooks";
import { collection, Feedback, History, Pager } from "./Common";
import styles from "./ads.module.css";

export default function AdminHistory() {
  const [filters, setFilters] = useState({ product_id: "", actor_id: "", action: "", from: "", to: "" });
  const [offset, setOffset] = useState(0);
  const query = new URLSearchParams({ limit: "20", offset: String(offset) });
  for (const [key, value] of Object.entries(filters)) if (value) {
    if (key === "from" || key === "to") { const date = new Date(value); if (Number.isFinite(date.getTime())) query.set(key, date.toISOString()); }
    else query.set(key, value);
  }
  const resource = useAdsResource(`/api/admin/ads/moderation-logs?${query}`), list = collection(resource.data);
  const actions = ["submitted", "resubmitted", "approved", "rejected", "changes_requested", "suspended", "unsuspended", "auto_reinstated", "edited", "deleted", "fee_charged", "fee_refunded", "promoted", "promotion_cancelled"];
  function change(key: keyof typeof filters, value: string) { setOffset(0); setFilters(previous => ({ ...previous, [key]: value })); }
  return <div className={styles.page}><header className={styles.header}><div><h1>Ad moderation audit</h1><p className={styles.muted}>Decisions, posting-fee charges and refunds, and promotion activity.</p></div><Link className={styles.button} href="/admin/ads">Review ads</Link></header><section className={styles.card}><div className={styles.filters}><label>Ad ID<input value={filters.product_id} onChange={event => change("product_id", event.target.value)} /></label><label>Actor ID<input value={filters.actor_id} onChange={event => change("actor_id", event.target.value)} /></label><label>Action<select value={filters.action} onChange={event => change("action", event.target.value)}><option value="">All actions</option>{actions.map(action => <option key={action} value={action}>{action.replace(/_/g, " ")}</option>)}</select></label><label>From<input type="datetime-local" value={filters.from} onChange={event => change("from", event.target.value)} /></label><label>To<input type="datetime-local" value={filters.to} onChange={event => change("to", event.target.value)} /></label><button onClick={resource.refresh}>Refresh</button></div><Feedback error={resource.error || list.error} />{resource.loading ? <p>Loading audit history…</p> : <History items={list.items} admin />}<Pager offset={offset} count={list.items.length} total={list.total} onPage={setOffset} /></section></div>;
}
