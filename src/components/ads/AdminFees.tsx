"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdsDirectory, useAdsMutation, useAdsResource } from "./hooks";
import { amount, money, record, rows, text, unwrap, type AdRecord } from "./data";
import { Feedback } from "./Common";
import styles from "./ads.module.css";

function feeRows(value: unknown): AdRecord[] {
  if (value === undefined) return [];
  try { return rows(value); } catch { /* Some versions separate default and category fees. */ }
  const data = record(unwrap(value));
  if ("default" in data || "default_fee" in data || "category_fees" in data) {
    const defaultFee = data.default_fee ?? data.default;
    return [...(defaultFee && typeof defaultFee === "object" ? [{ ...record(defaultFee), category_id: null }] : []), ...(Array.isArray(data.category_fees) ? data.category_fees.map(record) : [])];
  }
  throw new Error("The posting-fee list could not be read.");
}
export default function AdminFees() {
  const resource = useAdsResource("/api/admin/ads/fees"), categories = useAdsDirectory("/api/ads/categories");
  const [form, setForm] = useState({ kind: "default", category: "", amount: "", active: true });
  const [quoteCategory, setQuoteCategory] = useState("");
  const quote = useAdsResource(quoteCategory ? `/api/admin/ads/fees/quote?category_id=${encodeURIComponent(quoteCategory)}` : "");
  const [remove, setRemove] = useState("");
  const [error, setError] = useState("");
  const mutation = useAdsMutation();
  let fees: AdRecord[] = [], parseError = "";
  try { fees = feeRows(resource.data); } catch (failure) { parseError = failure instanceof Error ? failure.message : "Could not read fees."; }
  async function save(event: FormEvent) {
    event.preventDefault(); setError("");
    const price = Number(form.amount);
    if (!form.amount.trim() || !Number.isFinite(price) || price < 0 || price > 1e9 || (form.kind === "category" && !form.category)) { setError("Enter a valid fee and select the category for an override."); return; }
    const path = form.kind === "default" ? "default" : `categories/${encodeURIComponent(form.category)}`;
    if (await mutation.run(`/api/admin/ads/fees/${path}`, "PUT", { amount: price, is_active: form.active })) { resource.refresh(); quote.refresh(); }
  }
  return <div className={styles.page}><header className={styles.header}><div><h1>Ad posting fees</h1><p className={styles.muted}>Category overrides apply to their descendants. The backend resolves the nearest active category fee or default.</p></div><Link className={styles.button} href="/admin/ads">Review ads</Link></header>
    <Feedback error={error || mutation.error || resource.error || parseError || categories.error} message={mutation.message} uncertain={mutation.uncertain} />
    <section className={styles.card}><h2>Set a posting fee</h2><form className={styles.form} onSubmit={save}><label>Fee scope<select value={form.kind} disabled={mutation.disabled} onChange={event => setForm(previous => ({ ...previous, kind: event.target.value }))}><option value="default">Default</option><option value="category">Category override</option></select></label>{form.kind === "category" ? <label>Category<select value={form.category} required disabled={mutation.disabled} onChange={event => setForm(previous => ({ ...previous, category: event.target.value }))}><option value="">Select category</option>{categories.data?.map(item => <option key={text(item.id)} value={text(item.id)}>{text(item.name)}</option>)}</select></label> : null}<label>Fee (NGN)<input type="number" min={0} max={1000000000} step="0.01" required value={form.amount} disabled={mutation.disabled} onChange={event => setForm(previous => ({ ...previous, amount: event.target.value }))} /></label><label className={styles.check}><input type="checkbox" checked={form.active} disabled={mutation.disabled} onChange={event => setForm(previous => ({ ...previous, active: event.target.checked }))} />Active fee</label><div className={styles.wide}><p className={styles.muted}>Set an active fee of 0 for free posting in this scope. Rejection refunds are handled by the backend.</p><button type="submit" className={styles.primary} disabled={mutation.disabled}>Save posting fee</button></div></form></section>
    <section className={styles.card}><h2>Configured fees</h2>{resource.loading ? <p>Loading fees…</p> : fees.length ? <div className={styles.table}><table><thead><tr><th>Scope</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>{fees.map((fee, index) => { const category = text(fee.category_id ?? fee.categoryId); return <tr key={text(fee.id, category || String(index))}><td>{category ? text(record(fee.category).name, text(categories.data?.find(item => item.id === category)?.name, category)) : "Default"}</td><td>{money(fee.amount ?? fee.fee)}</td><td>{fee.is_active === false ? "Inactive" : "Active"}</td><td><div className={styles.actions}><button disabled={mutation.disabled} onClick={() => setForm({ kind: category ? "category" : "default", category, amount: text(fee.amount ?? fee.fee), active: fee.is_active !== false })}>Edit</button>{category ? <button className={styles.danger} disabled={mutation.disabled} onClick={() => setRemove(category)}>Remove override</button> : null}</div></td></tr>; })}</tbody></table></div> : !resource.error && !parseError ? <p>No posting fees are configured. Posting is free unless a fee is configured.</p> : null}{remove ? <div className={styles.notice}><p>Remove this category override? Its ads will use the applicable ancestor or default fee.</p><div className={styles.actions}><button disabled={mutation.disabled} onClick={async () => { if (await mutation.run(`/api/admin/ads/fees/categories/${encodeURIComponent(remove)}`, "DELETE")) { setRemove(""); resource.refresh(); quote.refresh(); } }}>Confirm removal</button><button disabled={mutation.busy} onClick={() => setRemove("")}>Cancel</button></div></div> : null}</section>
    <section className={styles.card}><h2>Check effective posting fee</h2><label>Category<select value={quoteCategory} onChange={event => setQuoteCategory(event.target.value)}><option value="">Select category</option>{categories.data?.map(item => <option key={text(item.id)} value={text(item.id)}>{text(item.name)}</option>)}</select></label><Feedback error={quote.error} />{quote.loading ? <p>Checking fee…</p> : quote.data ? <p className={styles.price}>{money(amount(quote.data, ["amount", "fee", "posting_fee", "fee_amount"]))}</p> : null}</section>
  </div>;
}
