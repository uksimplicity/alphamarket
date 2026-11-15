"use client";

import { useEffect, useState } from "react";
import { authGeneration, getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { assignedRider, deliveryStatusLabel, type AssignedRider } from "@/components/vendor/orderDelivery";
import { accountStamp, checkAccount } from "./localAccountData";
import type { BuyerOrder } from "./buyerOrders";
import { paymentError } from "./payments";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import styles from "./orderDetails.module.css";

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

  return <section className={styles.panel} aria-label="Delivery and rider tracking">
    <div className={styles.panelHeading}><h2>Delivery &amp; rider</h2><span className={styles.caption}>Your order’s journey</span></div>
    {tracking.required === false ? <p className={styles.caption}>No rider delivery is required for this order.</p> : <>
      <div className={styles.trackingHero}>
        <span className={styles.trackingIcon}><ShopperIcon name="truck" size={26} /></span>
        <div><dl><dt>Delivery status</dt><dd>{tracking.status ? deliveryStatusLabel(tracking.status) : "Awaiting delivery update"}</dd></dl>{!tracking.id ? <p>Your delivery is being arranged.</p> : null}</div>
      </div>
      <div className={styles.rider}>
        <span className={styles.icon}><ShopperIcon name="user" size={18} /></span>
        <dl><div><dt>Assigned rider</dt><dd>{tracking.riderId ? current?.rider?.name || (current ? "Rider assigned; awaiting details" : "Loading rider details...") : "Awaiting rider assignment"}</dd></div>
          {tracking.riderId ? <div><dt>Rider contact</dt><dd>{current?.rider?.phone || "Contact details pending"}</dd></div> : null}
          {tracking.updatedAt && Number.isFinite(Date.parse(tracking.updatedAt)) ? <div><dt>Delivery updated</dt><dd><time dateTime={tracking.updatedAt}>{new Date(tracking.updatedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time></dd></div> : null}
        </dl>
      </div>
      {current?.error ? <p role="alert" className={styles.alert}>{current.error} Use Refresh tracking to check again.</p> : null}
    </>}
    <div className={styles.trackingFooter}>
      {checkedAt ? <p>Last checked: <time dateTime={checkedAt}>{new Date(checkedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</time><br />Updates every 30 seconds while this page is visible.</p> : <p>Check back for the latest delivery updates.</p>}
      <button type="button" className={styles.refresh} disabled={refreshing} onClick={reload}><ShopperIcon name="refresh" size={13} />{refreshing ? "Refreshing..." : "Refresh tracking"}</button>
    </div>
  </section>;
}
