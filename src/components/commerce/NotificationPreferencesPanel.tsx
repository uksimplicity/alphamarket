"use client";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { notificationOptions, readNotificationChoices, resetNotificationChoices, saveNotificationChoice, type NotificationChoices } from "./notificationPreferences";
import styles from "./localFeatures.module.css";
function AccountChoices() {
  const [choices, setChoices] = useState<NotificationChoices | null>(null), [error, setError] = useState("");
  function load() { try { setChoices(readNotificationChoices()); setError(""); } catch (failure) { setError((failure as Error).message); } }
  useEffect(() => { void Promise.resolve().then(load); }, []);
  return <section className={styles.panel}><h1>Notifications</h1><p className={styles.muted}>Preferences are saved on this browser.</p>
    {error ? <div role="alert" className={styles.error}><p>{error}</p><button type="button" className={styles.button} onClick={load}>Retry</button>{!choices ? <button type="button" className={styles.button} onClick={() => { if (window.confirm("Reset all notification choices on this browser?")) { try { setChoices(resetNotificationChoices()); setError(""); } catch (failure) { setError((failure as Error).message); } } }}>Reset local preferences</button> : null}</div> : null}
    {Object.entries(notificationOptions).map(([key, label]) => <label className={styles.choice} key={key}><span>{label}</span><input aria-label={label} type="checkbox" disabled={!choices} checked={choices?.[key as keyof NotificationChoices] ?? false} onChange={e => { try { setChoices(saveNotificationChoice(key as keyof NotificationChoices, e.target.checked)); setError(""); } catch (failure) { setError((failure as Error).message); } }} /></label>)}
  </section>;
}
export default function NotificationPreferencesPanel() { const user = useAuthUser(); return <AccountChoices key={user?.id || user?.email || "signed-out"} />; }
