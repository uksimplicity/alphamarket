"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { cartSubtotal, formatCurrency, useCart } from "@/components/commerce/store";
import { checkoutUrl, checkoutStorageKey, readSavedCheckout, createdOrderIds, paymentError, paymentReference, type PendingCheckout } from "@/components/commerce/payments";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { Button, Card } from "@/components/dashboard/ui";
import styles from "./page.module.css";
import CheckoutAddresses from "@/components/commerce/CheckoutAddresses";
import DeliveryLocationButton from "@/components/commerce/deliveryLocation";
import { deliveryPoint } from "@/components/commerce/addresses";
import { useCheckoutPricing } from "@/components/commerce/useCheckoutPricing";
import OrderMoneyBreakdown from "@/components/commerce/OrderMoneyBreakdown";

export default function CheckoutPage() {
  const cart = useCart();
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const submitting = useRef(false);
  const review = useCheckoutPricing(pending?.orderIds ?? []);

  useEffect(() => {
    const auth = getAuth();
    setContact(auth?.user?.phone ?? "");
    try {
      const saved = auth?.user?.id ? readSavedCheckout(sessionStorage, auth.user.id) : null;
      if (saved) {
        const value = JSON.parse(saved) as PendingCheckout;
        if (value.buyerId === auth?.user?.id && value.submitted && Array.isArray(value.orderIds)) setPending(value);
      }
    } catch {
      setError("Checkout recovery is unavailable. Check your orders before starting another payment.");
    }
  }, []);

  async function pay() {
    if (submitting.current) return;
    setError("");
    const auth = getAuth();
    if (!auth?.access_token || !auth.user?.id) { setError("Please sign in with your buyer account to checkout."); return; }
    if (auth.user.role && auth.user.role !== "buyer") { setError("Please sign in with a buyer account to place an order."); return; }
    if (!agreed) { setError("Please accept the escrow terms to continue."); return; }
    if (pending?.orderIds.length && !review.ready) { setError("Review the confirmed order total before continuing to payment."); return; }
    if (!pending) {
      if (!cart.items.length) { setError("Your cart is empty."); return; }
      if (!address.trim()) { setError("Enter your delivery address."); return; }
      const lat = Number(latitude), lng = Number(longitude);
      if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        setError("Set a valid delivery location before continuing."); return;
      }
      if (cart.items.some((item) => !item.id || !Number.isInteger(item.qty) || item.qty < 1)) {
        setError("Your cart contains an invalid quantity. Update your cart and try again."); return;
      }
    }
    let stamp: string;
    try { stamp = accountStamp(); } catch (failure) { setError((failure as Error).message); return; }
    submitting.current = true;
    setLoading(true);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${auth.access_token.replace(/^Bearer\s+/i, "").trim()}` };
    async function request(path: string, body: unknown) {
      checkAccount(stamp);
      const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
      const payload = await response.json();
      checkAccount(stamp);
      if (!response.ok || payload?.success === false) {
        throw Object.assign(new Error(paymentError(payload, `Checkout request failed (${response.status}).`)), { status: response.status, path });
      }
      return payload;
    }
    function persist(value: PendingCheckout) {
      checkAccount(stamp);
      sessionStorage.setItem(checkoutStorageKey(auth!.user.id!), JSON.stringify(value));
      setPending(value);
    }
    try {
      let checkout = pending;
      if (checkout && checkout.buyerId !== auth.user.id) throw new Error("Sign in with the account that placed this order.");
      if (!checkout) {
        checkout = { buyerId: auth.user.id, orderIds: [], cartKey: JSON.stringify(cart.items), submitted: true };
        // Save before POST so a lost response cannot silently create duplicate orders.
        persist(checkout);
        const payload = await request("/api/buyer/orders", {
          buyer_id: auth.user.id, dropoff_address: address.trim(), dropoff_contact: contact.trim(),
          dropoff_lat: Number(latitude), dropoff_lng: Number(longitude), payment_method: "gateway",
          items: cart.items.map((item) => ({ product_id: item.id, quantity: item.qty })),
        });
        checkout = { ...checkout, orderIds: createdOrderIds(payload) };
        persist(checkout);
        // The saved order supplies delivery and total amounts for review before payment.
        return;
      }
      if (!checkout.orderIds.length) throw new Error("The previous order submission could not be confirmed. Check your orders before placing another order.");
      if (!checkout.checkoutUrl) {
        const payload = await request("/api/payments/initialize", {
          buyer_id: auth.user.id, order_ids: checkout.orderIds,
          callback_url: `${window.location.origin}/dashboard/checkout/payment`,
        });
        checkout = { ...checkout, checkoutUrl: checkoutUrl(payload), reference: paymentReference(payload) };
        persist(checkout);
      }
      window.location.assign(checkoutUrl({ checkout_url: checkout.checkoutUrl }));
    } catch (err) {
      // Validation/auth failures reject the order before creation; let the buyer correct them.
      const failure = err as { status?: number; path?: string };
      if (failure.path === "/api/buyer/orders" && [400, 401, 403, 422].includes(failure.status ?? 0)) {
        if (getAuth()?.access_token === auth.access_token) sessionStorage.removeItem(checkoutStorageKey(auth.user.id));
        setPending(null);
      }
      setError(err instanceof Error ? err.message : "Unable to start payment. Please try again.");
    } finally { submitting.current = false; setLoading(false); }
  }

  return (
    <div className={styles.checkoutPage}>
      <div className={styles.breadcrumbs}><Link href="/dashboard/cart">Shopping cart</Link><span>/</span><span>Checkout</span></div>
      {error ? <p className={styles.errorMessage} role="alert">{error}</p> : null}
      {pending ? <div className={styles.notice}>
        {pending.orderIds.length ? "Your order is saved. Review its product subtotal, delivery fee and total before continuing to payment." : "Your previous order submission needs to be checked before another order is placed."}
        {" "}<Link href="/dashboard/checkout/payment">Check payment status</Link>
      </div> : null}
      <div className={styles.checkoutLayout}>
        <div className={styles.checkoutLeft}>
          <Card><div className={styles.checkoutCard}>
            <div className={styles.cardHeader}><h2>Delivery Address</h2></div>
            <CheckoutAddresses address={address} contact={contact} latitude={latitude} longitude={longitude} disabled={loading || Boolean(pending)} onChoose={row => { setAddress(row.address); setContact(row.contact); setLatitude(String(row.latitude)); setLongitude(String(row.longitude)); }} />
            <fieldset className={styles.addressForm} disabled={loading || Boolean(pending)}>
              <label>Full delivery address<textarea autoComplete="street-address" value={address} onChange={(event) => { setAddress(event.target.value); setLatitude(""); setLongitude(""); }} placeholder="Street address, city and state" /></label>
              <label>Contact phone number<input type="tel" autoComplete="tel" value={contact} onChange={(event) => setContact(event.target.value)} /></label>
              <DeliveryLocationButton point={deliveryPoint(latitude, longitude)} onConfirm={point => { setLatitude(String(point.latitude)); setLongitude(String(point.longitude)); }} disabled={loading || Boolean(pending)} />
              <p className={styles.mutedText}>Choose the delivery point, or use your current location if you are at the delivery address. The backend calculates delivery using the seller and buyer locations.</p>
              {deliveryPoint(latitude, longitude) ? <p role="status" className={styles.mutedText}>Delivery location selected.</p> : null}
            </fieldset>
          </div></Card>
          <Card><div className={styles.checkoutCard}>
            <div className={styles.cardHeader}><h2>Payment Method</h2></div>
            <div className={styles.cardBody}><p className={styles.methodTitle}>Paystack — Card or Bank</p><p className={styles.mutedText}>Continue to Paystack to choose an available payment method and complete your payment.</p></div>
          </div></Card>
          <Card><div className={styles.checkoutCard}>
            <div className={styles.cardHeader}><h2>Alpha Marketplace Escrow</h2></div>
            <div className={styles.cardBody}>
              <div className={styles.infoBox}>Your payment is held in escrow until delivery is confirmed.</div>
              <label className={styles.checkboxRow}><input type="checkbox" checked={agreed} disabled={loading} onChange={(event) => setAgreed(event.target.checked)} /><span>I agree to the terms and conditions of the Alpha Marketplace Escrow system.</span></label>
            </div>
          </div></Card>
        </div>
        <Card><div className={styles.summaryCard}>
          <div className={styles.summaryHeader}><h3>{pending ? "Saved order pricing" : "Cart Summary"}</h3><Link href={pending ? "/dashboard/orders" : "/dashboard/cart"}>{pending ? "View orders" : "Edit cart"}</Link></div>
          {pending ? <p className={styles.mutedText}>Payment uses the saved order and its confirmed total.</p> : null}
          <div className={styles.summaryList}>
            {pending ? <p className={styles.mutedText}>Reviewing {pending.orderIds.length} saved {pending.orderIds.length === 1 ? "order" : "orders"}. Changes to your cart do not change this payment.</p> : cart.items.length === 0 ? <div className={styles.emptySummary}>No items yet. Add products to your cart.</div> : cart.items.map((item) => (
              <div key={item.id} className={styles.summaryItem}>
                <div className={styles.summaryThumb}><img src={item.image || "/placeholder.png"} alt={item.name} /></div>
                <div className={styles.summaryInfo}><div className={styles.summaryTitle}>{item.name}</div><div className={styles.summaryMeta}>Qty {item.qty} <span>{formatCurrency(item.price * item.qty)}</span></div></div>
              </div>
            ))}
          </div>
          <div className={styles.summaryTotals}>{pending?.orderIds.length ? <>
            {review.loading ? <p role="status">Loading confirmed order pricing...</p> : null}
            {review.pricing ? <OrderMoneyBreakdown pricing={review.pricing} /> : null}
            {review.error ? <p role="alert" className={styles.errorMessage}>{review.error}</p> : null}
            {!review.loading && !review.error && review.pricing?.buyerTotal == null ? <p role="alert">The backend has not returned a payable total yet.</p> : null}
            <Button variant="ghost" disabled={loading || review.loading} onClick={review.reload}>Refresh order pricing</Button>
          </> : <><div><span>Items subtotal</span><span>{formatCurrency(cartSubtotal(cart))}</span></div><p className={styles.mutedText}>Delivery is calculated by the backend after you submit the order for review. Your total is the product subtotal plus delivery. Admin commission is deducted from the seller’s share.</p></>}</div>
          <Button type="button" onClick={pay} disabled={loading || !agreed || (!pending && cart.items.length === 0) || Boolean(pending && (!pending.orderIds.length || !review.ready))}>
            {loading ? pending ? "Connecting to Paystack..." : "Creating order..." : pending ? "Continue to Paystack" : "Review order"}
          </Button>
        </div></Card>
      </div>
    </div>
  );
}
