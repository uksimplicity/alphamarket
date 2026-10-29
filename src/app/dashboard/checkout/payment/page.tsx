"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { clearCart, getCart } from "@/components/commerce/store";
import { orderPaymentStatus, paymentError, PENDING_CHECKOUT_KEY, type PendingCheckout } from "@/components/commerce/payments";
import { Button, Card } from "@/components/dashboard/ui";

export default function PaymentStatusPage() {
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("Checking your payment with the backend...");
  const [paid, setPaid] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [orders, setOrders] = useState<Array<{ id: string; status: string }>>([]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rounds = 0;
    setChecking(true);
    async function check() {
      try {
        const auth = getAuth();
        if (!auth?.access_token || !auth.user?.id) throw new Error("Sign in with the buyer account that placed the order to check payment.");
        const reference = new URL(window.location.href).searchParams.get("reference") || new URL(window.location.href).searchParams.get("trxref");
        const saved = sessionStorage.getItem(PENDING_CHECKOUT_KEY) ?? sessionStorage.getItem("alpha.last-paid-checkout.v1");
        const pending = saved ? JSON.parse(saved) as PendingCheckout : null;
        if (!pending || pending.buyerId !== auth.user.id || !Array.isArray(pending.orderIds) || !pending.orderIds.length) {
          throw new Error("No saved payment was found in this browser tab. Check your orders before starting another payment.");
        }
        if (reference && reference !== pending.reference) throw new Error("This payment reference does not match the saved checkout. Check your orders for its payment status.");
        const headers = { Authorization: `Bearer ${auth.access_token.replace(/^Bearer\s+/i, "").trim()}`, Accept: "application/json" };
        let verificationError = "";
        if (reference && rounds === 0) {
          const callback = await fetch(`/api/payments/callback?${new URLSearchParams({ reference })}`, { headers, cache: "no-store", signal: controller.signal });
          if (!callback.ok) verificationError = paymentError(await callback.json(), "Payment verification is delayed.");
        }
        const statuses = await Promise.all(pending.orderIds.map(async (id) => {
          const response = await fetch(`/api/user/orders/${encodeURIComponent(id)}`, { headers, cache: "no-store", signal: controller.signal });
          const payload = await response.json();
          if (!response.ok || payload?.success === false) throw new Error(paymentError(payload, "Could not check the order payment status."));
          return { id, status: orderPaymentStatus(payload) };
        }));
        if (controller.signal.aborted) return;
        setOrders(statuses);
        if (statuses.every((order) => order.status === "paid")) {
          setPaid(true);
          setMessage("Payment confirmed by the backend. Your order has been placed.");
          // Preserve products added or changed after the customer left for Paystack.
          if (JSON.stringify(getCart().items) === pending.cartKey) clearCart();
          // Keep confirmation available on refresh without allowing the order to be paid again.
          sessionStorage.setItem("alpha.last-paid-checkout.v1", JSON.stringify(pending));
          sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
          setChecking(false);
          return;
        }
        const failed = statuses.some((order) => ["failed", "cancelled", "expired", "reversed", "refunded", "chargeback"].includes(order.status));
        if (failed) {
          setMessage("Payment was not completed for every order. Check the statuses below before trying again.");
          setChecking(false);
          return;
        }
        rounds += 1;
        setMessage(verificationError || "Payment has not been confirmed yet. We are checking for an update; please do not pay again.");
        if (rounds < 10) timer = setTimeout(check, 3000);
        else { setChecking(false); setMessage("Payment is still awaiting confirmation. If you were debited, check again shortly before paying again."); }
      } catch (err) {
        if (controller.signal.aborted) return;
        setChecking(false);
        setMessage(err instanceof Error ? err.message : "Unable to check payment. Please try again.");
      }
    }
    void check();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [attempt]);

  return <Card>
    <div className="grid gap-4" aria-live="polite">
      <h1 className="text-xl font-semibold">{paid ? "Payment confirmed" : "Payment status"}</h1>
      <p>{message}</p>
      {orders.map((order) => <div key={order.id} className="rounded-xl border border-slate-200 p-3">
        <p className="break-all text-sm">Order {order.id}</p><p className="font-medium capitalize">{order.status}</p>
      </div>)}
      {!paid ? <Button disabled={checking} onClick={() => setAttempt((value) => value + 1)}>{checking ? "Checking payment..." : "Check again"}</Button> : null}
      {!paid ? <Link href="/dashboard/checkout" className="text-brand underline">Return to checkout</Link> : null}
      <Link href="/dashboard/orders" className="text-brand underline">View my orders</Link>
      <Link href="/dashboard/home" className="text-brand underline">Continue shopping</Link>
    </div>
  </Card>;
}
