"use client";
import { useState } from "react";
import { record, text, type AdRecord } from "./data";
import styles from "./ads.module.css";

export default function AdPoster({ item }: { item: AdRecord }) {
  const owner = record(item.owner ?? item.seller ?? item.user);
  const id = text(item.owner_id ?? item.seller_id ?? owner.id);
  const name = [text(owner.name), [text(owner.first_name), text(owner.last_name)].filter(Boolean).join(" "), text(item.owner_name), text(item.seller_name)].find(value => value.trim()) || "Name unavailable";
  const [message, setMessage] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(id); setMessage("Poster ID copied."); }
    catch { setMessage("Could not copy. Select the poster ID to copy it manually."); }
  }
  return <div className={styles.poster}>
    <span className={styles.factLabel}>Posted by</span><strong>{name}</strong>
    {item.poster_role ? <span className={styles.posterRole}>{text(item.poster_role)}</span> : null}
    {id ? <div className={styles.posterId}><span>Poster ID</span><code>{id}</code><button type="button" onClick={copy}>Copy ID</button></div> : null}
    {message ? <p role="status" className={styles.muted}>{message}</p> : null}
  </div>;
}
