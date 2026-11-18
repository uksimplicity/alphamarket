"use client";

import { useEffect, useState } from "react";
import { notificationPage, notificationRequest, type Notification } from "./notificationClient";
import { authGeneration } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { latestDeliveryNotice } from "./deliveryNoticeSelection";

export default function OrderDeliveryNotice({ orderId, refreshKey }: { orderId: string; refreshKey: string }) {
  const user = useAuthUser();
  const [state, setState] = useState<{ key: string; notice: Notification | null } | null>(null);
  const key = `${user?.id || ""}:${authGeneration()}:${orderId}:${refreshKey}`;
  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    void notificationRequest("?limit=100&offset=0", "GET", controller.signal)
      .then(payload => { if (!controller.signal.aborted) setState({ key, notice: latestDeliveryNotice(notificationPage(payload, 100, 0).items, orderId) }); })
      .catch(() => { if (!controller.signal.aborted) setState({ key, notice: null }); });
    return () => controller.abort();
  }, [key, orderId, user?.id]);
  const notice = state?.key === key ? state.notice : null;
  if (!notice) return null;
  return <p>Latest rider update: <strong>{notice.title}</strong> <time dateTime={notice.date}>({new Date(notice.date).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })})</time>.</p>;
}
