"use client";

import { useEffect, useState } from "react";
import { authGeneration, getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { assignedRider, deliveryStatusLabel, type AssignedRider } from "@/components/vendor/orderDelivery";
import { accountStamp, checkAccount } from "./localAccountData";
import type { BuyerOrder } from "./buyerOrders";
import { Button, Card, SectionTitle } from "@/components/dashboard/ui";
import { paymentError } from "./payments";

export default function BuyerDeliveryTracking({ order, checkedAt, refreshing, reload }: {
  order: BuyerOrder; checkedAt: string; refreshing: boolean; reload: () => void;
}) {
  const user = useAuthUser();
  const tracking = order.delivery;
  const key = `${user?.id || ""}:${authGeneration()}:${order.id}:${tracking.id}:${tracking.riderId}:${checkedAt}`;
  const [snapshot, setSnapshot] = useState<{ key: string; rider: AssignedRider | null; error: string } | null>(null);
  const current = snapshot?.key === key ? snapshot : null;
  useEffect(() => {
    if (tracking.required === false || !tracking.riderId || !user?.id) return;
    const controller = new AbortController();
    async function load() {
      try {
        const stamp = accountStamp();
        const token = getAuth()?.access_token || "";
        const response = await fetch(`/api/marketplace/grpc/riders/${encodeURIComponent(tracking.riderId)}`, {
          headers: { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, "").trim()}`, Accept: "application/json" },
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        const payload: unknown = await response.json();
        checkAccount(stamp);
        if (!response.ok) throw new Error(paymentError(payload, "Rider details could not be loaded."));
        const rider = assignedRider(payload, tracking.riderId);
        if (!controller.signal.aborted) setSnapshot({ key, rider, error: "" });
      } catch (error) {
        if (!controller.signal.aborted) setSnapshot({ key, rider: null, error: error instanceof Error ? error.message : "Rider details could not be loaded." });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, tracking.riderId, tracking.required, user?.id]);

  return <Card>
    <section aria-label="Delivery and rider tracking">
      <SectionTitle title="Delivery & rider" />
      {tracking.required === false ? <p className="mt-3 text-sm">No rider delivery is required for this order.</p> : <dl className="mt-3 grid gap-3 text-sm">
        <div><dt className="text-slate-500">Delivery status</dt><dd>{deliveryStatusLabel(tracking.status)}</dd></div>
        {!tracking.id ? <p>A delivery has not been linked to this order yet.</p> : null}
        <div><dt className="text-slate-500">Assigned rider</dt><dd>{tracking.riderId ? current?.rider?.name || (current ? "Assigned; name not reported" : "Loading rider details...") : "Rider assignment has not been reported."}</dd></div>
        {tracking.riderId ? <div><dt className="text-slate-500">Rider contact</dt><dd>{current?.rider?.phone || "Not reported"}</dd></div> : null}
        {current?.error ? <p role="alert">{current.error} Use Refresh tracking to check again.</p> : null}
        {tracking.updatedAt && Number.isFinite(Date.parse(tracking.updatedAt)) ? <div><dt className="text-slate-500">Delivery updated</dt><dd><time dateTime={tracking.updatedAt}>{new Date(tracking.updatedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time></dd></div> : null}
      </dl>}
      {checkedAt ? <p className="mt-3 text-xs text-slate-500">Last checked: <time dateTime={checkedAt}>{new Date(checkedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time>. Updates every 30 seconds while this page is visible.</p> : null}
      <div className="mt-3"><Button variant="ghost" disabled={refreshing} onClick={reload}>{refreshing ? "Refreshing..." : "Refresh tracking"}</Button></div>
    </section>
  </Card>;
}
