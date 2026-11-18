"use client";

import { useEffect, useState } from "react";
import { notificationPage, notificationRequest, type Notification } from "./notificationClient";
import { authGeneration } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { latestDeliveryNotice } from "./deliveryNoticeSelection";

export function useOrderDeliveryNotice(orderId: string, refreshKey: string, enabled: boolean) {
  const user = useAuthUser();
  const [state, setState] = useState<{ key: string; notice: Notification | null } | null>(null);
  const key = `${user?.id || ""}:${authGeneration()}:${orderId}`;
  useEffect(() => {
    if (!user?.id || !orderId || !enabled) return;
    const controller = new AbortController();
    void notificationRequest("?limit=100&offset=0", "GET", controller.signal)
      .then(payload => { if (!controller.signal.aborted) setState({ key, notice: latestDeliveryNotice(notificationPage(payload, 100, 0).items, orderId) }); })
      .catch(() => { if (!controller.signal.aborted) setState({ key, notice: null }); });
    return () => controller.abort();
  }, [key, orderId, user?.id, enabled, refreshKey]);
  return enabled && state?.key === key ? state.notice : null;
}
