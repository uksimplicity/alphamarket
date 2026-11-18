"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { useRouter } from "next/navigation";
import { getAuth } from "@/components/auth/authStorage";
import { useBuyerOrders, type BuyerOrder } from "@/components/commerce/buyerOrders";
import {
  formatCurrency,
} from "@/components/commerce/store";
import { Button, Card, SectionTitle } from "@/components/dashboard/ui";
import ReviewDraftButton from "@/components/commerce/ReviewDraftButton";
import BuyerOrderSeller from "@/components/commerce/BuyerOrderSeller";
import { orderDeliveryLabel } from "@/components/vendor/orderDelivery";

export default function OrdersPage() {
  const user = useAuthUser();
  const [page, setPage] = useState({ owner: "", offset: 0 });
  const offset = page.owner === user?.id ? page.offset : 0;
  const { orders, loading, error, reload, refreshing } = useBuyerOrders(undefined, offset, 20);
  const router = useRouter();
  function payOrder(order: BuyerOrder) {
    const buyerId = getAuth()?.user?.id;
    if (!buyerId) return;
    router.push(`/dashboard/checkout?order=${encodeURIComponent(order.id)}`);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="My Orders" subtitle="Follow your orders from payment through delivery." />
        <p className="mt-2 text-xs text-slate-500">Delivery updates are checked every 15 seconds while this page is visible.</p>
        {loading ? <p className="mt-4 text-sm">Loading orders...</p> : null}
        {error ? <div role="alert" className="mt-4 text-red-700">{error} <Button onClick={reload}>Retry</Button></div> : null}
        <div className="mt-4 space-y-4">
          {!loading && !error && orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              {offset ? "No more orders on this page. Use Previous to return to your orders." : "You have no orders yet. Place your first order to see updates here."}
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Order #{order.id.slice(-8).toUpperCase()}
                    </div>
                    <div className="text-xs text-slate-500">
                      <BuyerOrderSeller order={order} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-semibold text-slate-800">
                      {order.total === null ? "Total unavailable" : formatCurrency(order.total)}
                    </div>
                    <Link
                      href={`/dashboard/orders/${order.id}`}
                      className="text-xs font-semibold text-brand"
                    >
                      View order →
                    </Link>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <p className="rounded-xl bg-slate-50 p-3 text-sm capitalize"><span className="block text-xs text-slate-500">Order</span>{order.status.replaceAll("_", " ")}</p>
                  <p className="rounded-xl bg-slate-50 p-3 text-sm capitalize"><span className="block text-xs text-slate-500">Payment</span>{order.paymentStatus.replaceAll("_", " ")}</p>
                  <p className="rounded-xl bg-blue-50 p-3 text-sm"><span className="block text-xs text-blue-600">Delivery</span><span className="font-medium text-slate-800">{order.deliveryError && !order.delivery.status ? "Tracking unavailable" : orderDeliveryLabel(order.delivery)}</span></p>
                  {order.deliveryError ? <p className="text-xs text-amber-700">Latest delivery tracking is unavailable. Open the order for details.</p> : null}
                  {["delivered", "confirmed"].includes(order.status) ? <ReviewDraftButton orderId={order.id} /> : null}
                  {order.paymentStatus === "pending" && order.status !== "cancelled" ? <Button onClick={() => payOrder(order)}>Resume payment</Button> : null}
                </div>
              </div>
            ))
          )}
        </div>
        <nav aria-label="Order pages" className="mt-5 flex items-center justify-between gap-3 text-sm text-slate-500">
          <Button variant="ghost" disabled={!offset || loading || refreshing} onClick={() => setPage({ owner: user?.id || "", offset: Math.max(0, offset - 20) })}>Previous</Button>
          <span>Page {Math.floor(offset / 20) + 1}</span>
          <Button variant="ghost" disabled={loading || refreshing || Boolean(error) || orders.length < 20} onClick={() => setPage({ owner: user?.id || "", offset: offset + 20 })}>Next</Button>
        </nav>
        {!loading && !error && orders.length === 0 && offset === 0 ? (
          <div className="mt-4">
            <Link
              href="/dashboard/home"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Browse products
            </Link>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
