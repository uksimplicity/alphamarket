"use client";
import Link from "next/link";
import { date, label, record, rows, text, type AdRecord } from "./data";
import styles from "./ads.module.css";

export function Feedback({ error, message, uncertain }: { error?: string; message?: string; uncertain?: boolean }) {
  return <>{error ? <div role="alert" className={styles.error}>{error}</div> : null}{message ? <div role="status" className={styles.success}>{message}</div> : null}{uncertain ? <div className={styles.notice}>The result could not be confirmed. Check the record and wallet before trying again. <button type="button" onClick={() => window.location.reload()}>Reload page</button></div> : null}</>;
}
export function Pager({ offset, count, total, onPage }: { offset: number; count: number; total?: unknown; onPage: (offset: number) => void }) {
  return <div className={styles.actions}><button disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - 20))}>Previous</button><span className={styles.muted}>{count ? `${offset + 1}–${offset + count}` : "No results"}{typeof total === "number" ? ` of ${total}` : ""}</span><button disabled={typeof total === "number" ? offset + count >= total : count < 20} onClick={() => onPage(offset + 20)}>Next</button></div>;
}
export function collection(payload: unknown): { items: AdRecord[]; error?: string; total?: unknown } {
  if (payload === undefined) return { items: [] };
  try { return { items: rows(payload), total: record(record(payload).meta).total }; }
  catch (failure) { return { items: [], error: failure instanceof Error ? failure.message : "Could not read this list." }; }
}
export function History({ items, admin = false }: { items: AdRecord[]; admin?: boolean }) {
  return items.length ? <div className={styles.list}>{items.map((item, index) => <article key={text(item.id, String(index))} className={styles.log}><strong>{label(item.action || item.status)}</strong><p>{text(item.reason ?? item.note ?? item.message, "No note recorded.")}</p><small className={styles.muted}>{date(item.created_at ?? item.timestamp)}{item.actor_id ? ` · ${text(item.actor_id)}` : ""}</small>{admin && item.product_id ? <p><Link href={`/admin/ads/${encodeURIComponent(text(item.product_id))}`}>View ad</Link></p> : null}</article>)}</div> : <p className={styles.empty}>No moderation history yet.</p>;
}
