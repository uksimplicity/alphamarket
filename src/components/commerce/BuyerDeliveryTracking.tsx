"use client";

import { useEffect, useState } from "react";
import { authGeneration, getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { orderDeliveryLabel, type AssignedRider } from "@/components/vendor/orderDelivery";
import { loadOrderRiderTracking, type DeliveryTracking } from "./orderRiderTracking";
import { accountStamp, checkAccount } from "./localAccountData";
import type { BuyerOrder } from "./buyerOrders";
import { paymentError } from "./payments";
import ShopperIcon from "@/components/marketplace/ShopperIcon";
import { sellerPhone, sellerPhoneHref } from "@/components/products/sellerPhone";
import styles from "./orderDetails.module.css";
import DeliveryProgress from "./DeliveryProgress";

export default function BuyerDeliveryTracking({ order, checkedAt, refreshing, reload }: {
  order: BuyerOrder; checkedAt: string; refreshing: boolean; reload: () => void;
}) {
  const user = useAuthUser();
  const initial = order.delivery;
  const key = `${user?.id || ""}:${authGeneration()}:${order.id}:${initial.id}:${initial.riderId}:${initial.status}:${checkedAt}`;
  const [snapshot, setSnapshot] = useState<{ key: string; tracking: DeliveryTracking; rider: AssignedRider | null; error: string } | null>(null);
  const current = snapshot?.key === key ? snapshot : null;
  const tracking = current?.tracking ?? initial;
  useEffect(() => {
    if (initial.required === false || (!initial.riderId && !initial.id) || !user?.id) return;
    const controller = new AbortController();
    async function load() {
      try {
        const stamp = accountStamp();
        const token = getAuth()?.access_token || "";
        const request = async (path: string) => {
          controller.signal.throwIfAborted();
          checkAccount(stamp);
          const response = await fetch(path, {
            headers: { Authorization: `Bearer ${token.replace(/^Bearer\s+/i, "").trim()}`, Accept: "application/json" },
            cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
          });
          const payload: unknown = await response.json();
          checkAccount(stamp);
          const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
          if (!response.ok || root.success === false) throw new Error(paymentError(payload, "Delivery and rider details could not be loaded."));
          return payload;
        };
        const result = await loadOrderRiderTracking(request, initial, order.id);
        checkAccount(stamp);
        if (!controller.signal.aborted) setSnapshot({ key, tracking: result.tracking, rider: result.rider, error: result.riderError });
      } catch (error) {
        if (!controller.signal.aborted) setSnapshot({ key, tracking: initial, rider: null, error: error instanceof Error ? error.message : "Rider details could not be loaded." });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, initial, order.id, user?.id]);

  return <section className={styles.panel} aria-label="Delivery and rider tracking">
    <div className={styles.panelHeading}><h2>Delivery &amp; rider</h2><button type="button" className={styles.refresh} disabled={refreshing} onClick={reload}><ShopperIcon name="refresh" size={13} />{refreshing ? "Refreshing..." : "Refresh tracking"}</button></div>
    {tracking.required === false ? <p className={styles.caption}>No rider delivery is required for this order.</p> : <>
      <div className={styles.trackingHero}>
        <span className={styles.trackingIcon}><ShopperIcon name="truck" size={26} /></span>
        <div><dl><dt>Delivery status</dt><dd>{current?.error && !tracking.status ? "Tracking unavailable" : orderDeliveryLabel(tracking)}</dd></dl>{!tracking.id && !current?.error ? <p>Your delivery is being arranged.</p> : null}</div>
      </div>
      <DeliveryProgress tracking={tracking} />
      <div className={styles.rider}>
        <span className={styles.icon}><ShopperIcon name="user" size={18} /></span>
        <dl><div><dt>Assigned rider</dt><dd>{tracking.riderId ? current?.rider?.name || (current ? "Rider assigned; awaiting details" : "Loading rider details...") : current?.error ? "Rider assignment unavailable" : "Awaiting rider assignment"}</dd></div>
          {tracking.riderId ? <div><dt>Rider contact</dt><dd>{sellerPhone(current?.rider?.phone) ? <a className={styles.callRider} href={sellerPhoneHref(sellerPhone(current?.rider?.phone))} aria-label={`Call rider at ${current?.rider?.phone}`}><ShopperIcon name="phone" size={15} /><span>{current?.rider?.phone}</span></a> : "Contact details pending"}</dd></div> : null}
          {tracking.updatedAt && Number.isFinite(Date.parse(tracking.updatedAt)) ? <div><dt>Delivery updated</dt><dd><time dateTime={tracking.updatedAt}>{new Date(tracking.updatedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time></dd></div> : null}
        </dl>
      </div>
      {current?.error ? <details className={styles.alert}><summary>Delivery tracking is unavailable</summary><p role="alert">{current.error} Use Refresh tracking to check again.</p></details> : null}
    </>}
    <div className={styles.destination}><span className={styles.icon}><ShopperIcon name="pin" size={18} /></span><div><h3>Delivery address</h3><address className={styles.address}>{order.address || "Delivery address unavailable"}</address></div></div>
    <div className={styles.trackingFooter}>
      {checkedAt ? <p>Last checked: <time dateTime={checkedAt}>{new Date(checkedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" })}</time><br />Checks for updates every 15 seconds while this page is visible.</p> : <p>Check back for the latest delivery updates.</p>}
    </div>
  </section>;
}
