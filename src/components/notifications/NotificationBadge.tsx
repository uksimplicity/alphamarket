"use client";
import { useEffect, useState } from "react";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { authGeneration } from "@/components/auth/authStorage";
import { notificationRequest, NOTIFICATIONS_UPDATED, unreadCount } from "./notificationClient";
import styles from "./notifications.module.css";

export default function NotificationBadge() {
  const user = useAuthUser();
  const key = `${user?.id || user?.email || ""}:${authGeneration()}`;
  const [state, setState] = useState<{ key: string; count: number | null }>({ key: "", count: null });
  useEffect(() => {
    if (!user) return;
    let active = true, serial = 0;
    let controller: AbortController | undefined;
    async function refresh() {
      if (document.visibilityState === "hidden") return;
      const request = ++serial;
      controller?.abort(); controller = new AbortController();
      try {
        const count = unreadCount(await notificationRequest("/unread-count", "GET", controller.signal));
        if (active && request === serial) setState({ key, count });
      } catch { if (active && request === serial) setState({ key, count: null }); }
    }
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener(NOTIFICATIONS_UPDATED, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; controller?.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener(NOTIFICATIONS_UPDATED, refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [key, user]);
  const count = user && state.key === key ? state.count : null;
  return count !== null && count > 0 ? <span className={styles.badge} aria-label={`${count} unread notifications`}>{count > 99 ? "99+" : count}</span> : null;
}
