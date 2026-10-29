"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { cartSubtotal, formatCurrency, useCart } from "@/components/commerce/store";
import { checkoutUrl, createdOrderIds, paymentError, paymentReference, PENDING_CHECKOUT_KEY, type PendingCheckout } from "@/components/commerce/payments";
import { Button, Card } from "@/components/dashboard/ui";
import styles from "./page.module.css";

export default function CheckoutPage() {
  const cart = useCart();
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const submitting = useRef(false);

  useEffect(() => {
    const auth = getAuth();
    setContact(auth?.user?.phone ?? "");
    try {
      const saved = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
      if (saved) {
        const value = JSON.parse(saved) as PendingCheckout;
        if (value.buyerId === auth?.user?.id && value.submitted && Array.isArray(value.orderIds)) setPending(value);
      }
    } catch {
      setError("Checkout recovery is unavailable. Check your orders before starting another payment.");
    }
  }, []);

  function locateDelivery() {
    setError("");
    if (!navigator.geolocation) { setError("Location is unavailable. Enter your delivery coordinates below."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setLatitude(String(coords.latitude)); setLongitude(String(coords.longitude)); setLocating(false); },
      () => { setError("Could not get your location. Allow location access or enter your delivery coordinates."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function pay() {
    if (submitting.current) return;
    setError("");
    const auth = getAuth();
    if (!auth?.access_token || !auth.user?.id) { setError("Please sign in with your buyer account to checkout."); return; }
    if (auth.user.role && auth.user.role !== "buyer") { setError("Please sign in with a buyer account to place an order."); return; }
    if (!agreed) { setError("Please accept the escrow terms to continue."); return; }
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
    submitting.current = true;
    setLoading(true);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${auth.access_token.replace(/^Bearer\s+/i, "").trim()}` };
    async function request(path: string, body: unknown) {
      const response = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok || payload?.success === false) {
        throw Object.assign(new Error(paymentError(payload, `Checkout request failed (${response.status}).`)), { status: response.status, path });
      }
      return payload;
    }
    function persist(value: PendingCheckout) {
      sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify(value));
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
        sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
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
        {pending.orderIds.length ? "An order is awaiting payment. Continue to pay for that order." : "Your previous order submission needs to be checked before another order is placed."}
        {" "}<Link href="/dashboard/checkout/payment">Check payment status</Link>
      </div> : null}
      <div className={styles.checkoutLayout}>
        <div className={styles.checkoutLeft}>
          <Card><div className={styles.checkoutCard}>
            <div className={styles.cardHeader}><h2>Delivery Address</h2></div>
            <fieldset className={styles.addressForm} disabled={loading || Boolean(pending)}>
              <label>Full delivery address<textarea autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street address, city and state" /></label>
              <label>Contact phone number<input type="tel" autoComplete="tel" value={contact} onChange={(event) => setContact(event.target.value)} /></label>
              <Button type="button" onClick={locateDelivery} disabled={locating}>{locating ? "Finding location..." : "Use my current location"}</Button>
              <p className={styles.mutedText}>Use your current location only if you are at the delivery address, or enter its coordinates.</p>
              <div className={styles.coordinateFields}>
                <label>Latitude<input type="number" step="any" min="-90" max="90" value={latitude} onChange={(event) => setLatitude(event.target.value)} /></label>
                <label>Longitude<input type="number" step="any" min="-180" max="180" value={longitude} onChange={(event) => setLongitude(event.target.value)} /></label>
              </div>
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
          <div className={styles.summaryHeader}><h3>Cart Summary</h3><Link href="/dashboard/cart">Edit cart</Link></div>
          {pending ? <p className={styles.mutedText}>Payment will use the saved order. Its final total is confirmed by the backend and displayed on Paystack.</p> : null}
          <div className={styles.summaryList}>
            {cart.items.length === 0 ? <div className={styles.emptySummary}>No items yet. Add products to your cart.</div> : cart.items.map((item) => (
              <div key={item.id} className={styles.summaryItem}>
                <div className={styles.summaryThumb}><img src={item.image || "/placeholder.png"} alt={item.name} /></div>
                <div className={styles.summaryInfo}><div className={styles.summaryTitle}>{item.name}</div><div className={styles.summaryMeta}>Qty {item.qty} <span>{formatCurrency(item.price * item.qty)}</span></div></div>
              </div>
            ))}
          </div>
          <div className={styles.summaryTotals}><div><span>Items subtotal</span><span>{formatCurrency(cartSubtotal(cart))}</span></div><p className={styles.mutedText}>Final amount, including any delivery charges, is confirmed before payment on Paystack.</p></div>
          <Button type="button" onClick={pay} disabled={loading || !agreed || (!pending && cart.items.length === 0) || Boolean(pending && !pending.orderIds.length)}>
            {loading ? "Connecting to Paystack..." : pending ? "Continue Payment" : "Pay Now"}
          </Button>
        </div></Card>
      </div>
    </div>
  );
}
