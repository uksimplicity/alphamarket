"use client";
import { useEffect, useRef, useState } from "react";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { authGeneration, isSellerRole } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { notificationLink, notificationPage, notificationRequest, notifyNotificationsChanged } from "./notificationClient";
import NotificationPreferencesPanel from "@/components/commerce/NotificationPreferencesPanel";
import styles from "./notifications.module.css";

function Inbox({ seller }: { seller: boolean }) {
  const [filter, setFilter] = useState("all"), [offset, setOffset] = useState(0), [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; page?: ReturnType<typeof notificationPage>; error?: string }>({ key: "" });
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const lock = useRef(false);
  const key = `${filter}:${offset}:${revision}`;
  useEffect(() => {
    const controller = new AbortController();
    const query = `?limit=20&offset=${offset}${filter === "unread" ? "&is_read=false" : ""}`;
    void notificationRequest(query, "GET", controller.signal)
      .then(result => { if (!controller.signal.aborted) setState({ key, page: notificationPage(result, 20, offset) }); })
      .catch(failure => { if (!controller.signal.aborted) setState({ key, error: failure instanceof Error ? failure.message : "Could not load notifications." }); });
    return () => controller.abort();
  }, [key, filter, offset]);
  const current = state.key === key ? state : null;
  function refresh() { setOffset(0); setRevision(value => value + 1); }
  async function mutate(path: string, method: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    let stamp: string | undefined;
    try {
      stamp = accountStamp();
      await notificationRequest(path, method);
      checkAccount(stamp);
    } catch (failure) {
      if (stamp) { try { checkAccount(stamp); } catch { return; } }
      setError(failure instanceof Error ? failure.message : "The change could not be confirmed. Refresh notifications.");
    } finally {
      if (stamp) {
        try { checkAccount(stamp); refresh(); notifyNotificationsChanged(); } catch { /* Previous account cannot update the current inbox. */ }
      }
      lock.current = false; setBusy(false);
    }
  }
  return <section className={styles.panel}>
    <header className={styles.heading}><div><h1>Notifications</h1><p>Updates about your account, orders and messages.</p></div><button type="button" disabled={busy} onClick={() => { refresh(); notifyNotificationsChanged(); }}>Refresh</button></header>
    <div className={styles.toolbar}><div role="group" aria-label="Filter notifications">{["all", "unread"].map(value => <button type="button" key={value} aria-pressed={filter === value} disabled={busy} onClick={() => { setFilter(value); setOffset(0); }}>{value === "all" ? "All" : "Unread"}</button>)}</div><button type="button" disabled={busy || !current?.page} onClick={() => void mutate("/read-all", "POST")}>Mark all as read</button></div>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {!current ? <p role="status">Loading notifications…</p> : current.error ? <div role="alert"><p className={styles.error}>{current.error}</p><button type="button" onClick={refresh}>Retry</button></div> : !current.page?.items.length ? <p className={styles.empty}>{filter === "unread" ? "You're all caught up. No unread notifications." : "No notifications yet."}</p> : <ul className={styles.list}>{current.page.items.map(item => {
      const href = notificationLink(item, seller), date = new Date(item.date);
      return <li key={item.id} className={item.isRead ? styles.read : styles.unread}>
        <div className={styles.itemHeading}><h2>{!item.isRead ? <span className={styles.dot} aria-label="Unread" /> : null}{item.title}</h2>{Number.isFinite(date.getTime()) ? <time dateTime={date.toISOString()}>{date.toLocaleString()}</time> : null}</div>
        <p className={styles.body}>{item.body}</p>{item.count > 1 ? <p className={styles.muted}>{item.count} updates</p> : null}
        <div className={styles.actions}>{href ? <a href={href}>View details</a> : null}{!item.isRead ? <button type="button" disabled={busy} onClick={() => void mutate(`/${encodeURIComponent(item.id)}/read`, "PATCH")}>Mark as read<span className={styles.srOnly}>: {item.title}</span></button> : null}<button type="button" disabled={busy} onClick={() => void mutate(`/${encodeURIComponent(item.id)}`, "DELETE")}>Delete<span className={styles.srOnly}>: {item.title}</span></button></div>
      </li>;
    })}</ul>}
    {current?.page ? <nav className={styles.pagination} aria-label="Notification pages"><button type="button" disabled={busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous</button><span>Page {Math.floor(offset / 20) + 1}</span><button type="button" disabled={busy || !current.page.hasMore} onClick={() => setOffset(value => value + 20)}>Next</button></nav> : null}
    <details className={styles.preferences}><summary>Notification preferences</summary><NotificationPreferencesPanel /></details>
  </section>;
}

export default function NotificationsPanel() {
  const user = useAuthUser();
  if (!user) return <section className={styles.panel}>Sign in to view your notifications.</section>;
  return <Inbox key={`${user.id || user.email}:${authGeneration()}`} seller={isSellerRole(user.role)} />;
}
