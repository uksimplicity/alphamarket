"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { adsRequest } from "./client";
import { useAdsDirectory, useAdsMutation, useAdsResource } from "./hooks";
import { adRecord, hierarchyLabel, label, money, record, text, type AdRecord } from "./data";
import { collection, Feedback } from "./Common";
import styles from "./ads.module.css";

const empty = { id: "", name: "", type: "featured", price: "", duration: "7", description: "", active: true, badgeLabel: "", badgeColor: "", sort: "0", categories: [] as string[], locations: [] as string[] };
const ids = (value: unknown) => Array.isArray(value) ? value.map(item => typeof item === "string" ? item : text(record(item).id)).filter(Boolean) : [];
export default function AdminPlans() {
  const [type, setType] = useState("");
  const resource = useAdsResource(`/api/admin/promotion-plans${type ? `?type=${type}` : ""}`), list = collection(resource.data);
  const categories = useAdsDirectory("/api/ads/categories"), locations = useAdsDirectory("/api/ads/locations");
  const [form, setForm] = useState(empty), [open, setOpen] = useState(false), [loadingPlan, setLoadingPlan] = useState(false), [remove, setRemove] = useState<AdRecord | null>(null), [error, setError] = useState("");
  const mutation = useAdsMutation();
  const disabled = mutation.disabled || loadingPlan;
  async function edit(item: AdRecord) {
    setLoadingPlan(true); setError("");
    try {
      const plan = adRecord(await adsRequest(`/api/admin/promotion-plans/${encodeURIComponent(text(item.id))}`));
      const actual = Object.keys(record(plan.plan)).length ? record(plan.plan) : plan;
      if (!actual.id) throw new Error("The promotion plan could not be read.");
      setForm({ id: text(actual.id), name: text(actual.name), type: text(actual.type, "featured"), price: text(actual.price), duration: text(actual.duration_days), description: text(actual.description), active: actual.is_active !== false, badgeLabel: text(actual.badge_label), badgeColor: text(actual.badge_color), sort: text(actual.sort_order, "0"), categories: ids(actual.category_ids ?? actual.categories), locations: ids(actual.location_ids ?? actual.locations) }); setOpen(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not load plan."); }
    finally { setLoadingPlan(false); }
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError("");
    const price = Number(form.price), duration = Number(form.duration), order = Number(form.sort);
    if (!form.name.trim() || !form.price.trim() || !Number.isFinite(price) || price < 0 || !Number.isInteger(duration) || duration < 1 || duration > 365 || !Number.isInteger(order)) { setError("Enter a name, non-negative price and duration between 1 and 365 days."); return; }
    const body = { name: form.name.trim(), type: form.type, price, duration_days: duration, description: form.description.trim(), is_active: form.active, badge_label: form.badgeLabel.trim(), badge_color: form.badgeColor.trim(), sort_order: order, category_ids: form.categories, location_ids: form.locations };
    if (await mutation.run(`/api/admin/promotion-plans${form.id ? `/${encodeURIComponent(form.id)}` : ""}`, form.id ? "PUT" : "POST", body)) { setOpen(false); setForm(empty); resource.refresh(); }
  }
  return <div className={styles.page}><header className={styles.header}><div><h1>Ad promotion plans</h1><p className={styles.muted}>Create Featured, Premium and VIP plans. Changes apply to future purchases.</p></div><div className={styles.actions}><Link className={styles.button} href="/admin/ad-promotions">Purchased promotions</Link><button className={styles.primary} disabled={disabled} onClick={() => { setForm(empty); setOpen(true); }}>Create plan</button></div></header><Feedback error={error || mutation.error || resource.error || list.error || categories.error || locations.error} message={mutation.message} uncertain={mutation.uncertain} />
    {open ? <section className={styles.card}><h2>{form.id ? "Edit plan" : "Create plan"}</h2><form className={styles.form} onSubmit={save}>
      <label>Name<input value={form.name} maxLength={150} required disabled={disabled} onChange={event => setForm(previous => ({ ...previous, name: event.target.value }))} /></label><label>Type<select value={form.type} disabled={disabled} onChange={event => setForm(previous => ({ ...previous, type: event.target.value }))}>{["featured", "premium", "vip"].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label>
      <label>Price (NGN)<input type="number" min={0} step="0.01" required value={form.price} disabled={disabled} onChange={event => setForm(previous => ({ ...previous, price: event.target.value }))} /></label><label>Duration (days)<input type="number" min={1} max={365} required value={form.duration} disabled={disabled} onChange={event => setForm(previous => ({ ...previous, duration: event.target.value }))} /></label><label className={styles.wide}>Description<textarea value={form.description} disabled={disabled} onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))} /></label>
      <label>Badge label<input value={form.badgeLabel} maxLength={50} disabled={disabled} onChange={event => setForm(previous => ({ ...previous, badgeLabel: event.target.value }))} /></label><label>Badge colour<input placeholder="e.g. #C7A33B" value={form.badgeColor} maxLength={20} disabled={disabled} onChange={event => setForm(previous => ({ ...previous, badgeColor: event.target.value }))} /></label><label>Sort order<input type="number" value={form.sort} disabled={disabled} onChange={event => setForm(previous => ({ ...previous, sort: event.target.value }))} /></label><label className={styles.check}><input type="checkbox" checked={form.active} disabled={disabled} onChange={event => setForm(previous => ({ ...previous, active: event.target.checked }))} />Available for purchase</label>
      <label>Category targeting<select multiple value={form.categories} disabled={disabled} onChange={event => { const values = Array.from(event.target.selectedOptions, option => option.value); setForm(previous => ({ ...previous, categories: values })); }}>{categories.data?.map(item => <option key={text(item.id)} value={text(item.id)}>{text(item.name)}</option>)}</select><small>Leave empty for all categories.</small></label><label>Location targeting<select multiple value={form.locations} disabled={disabled} onChange={event => { const values = Array.from(event.target.selectedOptions, option => option.value); setForm(previous => ({ ...previous, locations: values })); }}>{locations.data?.map(item => <option key={text(item.id)} value={text(item.id)}>{hierarchyLabel(item, locations.data || [])}</option>)}</select><small>Leave empty for all supported locations.</small></label>
      <div className={`${styles.actions} ${styles.wide}`}><button type="submit" className={styles.primary} disabled={disabled}>Save plan</button><button type="button" disabled={mutation.busy} onClick={() => setOpen(false)}>Cancel</button></div></form></section> : null}
    <section className={styles.card}><div className={styles.filters}><label>Type<select value={type} onChange={event => setType(event.target.value)}><option value="">All promotion types</option>{["featured", "premium", "vip"].map(value => <option key={value} value={value}>{label(value)}</option>)}</select></label><button onClick={resource.refresh}>Refresh</button></div>{resource.loading ? <p>Loading plans…</p> : list.items.length ? <div className={styles.table}><table><thead><tr><th>Plan</th><th>Price</th><th>Duration</th><th>Status</th><th /></tr></thead><tbody>{list.items.map(plan => <tr key={text(plan.id)}><td><strong>{text(plan.name)}</strong><p>{label(plan.type)}</p></td><td>{money(plan.price)}</td><td>{text(plan.duration_days)} days</td><td>{plan.is_active === false ? "Off sale" : "Active"}</td><td><div className={styles.actions}><button disabled={disabled} onClick={() => void edit(plan)}>Edit</button><button className={styles.danger} disabled={disabled} onClick={() => setRemove(plan)}>Take off sale</button></div></td></tr>)}</tbody></table></div> : !resource.error && !list.error ? <p className={styles.empty}>No promotion plans yet. Create one to enable ad promotions.</p> : null}{remove ? <div className={styles.notice}><p>Take {text(remove.name)} off sale? Existing purchased promotions will keep running.</p><div className={styles.actions}><button disabled={disabled} onClick={async () => { if (await mutation.run(`/api/admin/promotion-plans/${encodeURIComponent(text(remove.id))}`, "DELETE")) { setRemove(null); resource.refresh(); } }}>Confirm removal</button><button disabled={mutation.busy} onClick={() => setRemove(null)}>Cancel</button></div></div> : null}</section>
  </div>;
}
