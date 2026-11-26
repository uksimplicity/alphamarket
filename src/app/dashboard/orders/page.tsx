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
              <article key={order.id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 sm:p-5">
                <div className="flex items-start gap-4">
                  <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 text-slate-400 sm:h-24 sm:w-24">
                    {order.items[0]?.image ? <img src={order.items[0].image} alt="" className="h-full w-full object-contain" /> : <span aria-hidden="true" className="text-2xl">?</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={'/dashboard/orders/' + encodeURIComponent(order.id)} className="block text-base font-semibold text-slate-900 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
                      {order.items[0]?.name || "Order details"}{order.items.length > 1 ? ' + ' + (order.items.length - 1) + ' more' : ""}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500">Order #{order.id.slice(-8).toUpperCase()} ? <BuyerOrderSeller order={order} /></p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className={'rounded-lg px-2.5 py-1 font-semibold capitalize ' + (["delivered", "confirmed"].includes(order.status) ? "bg-green-50 text-green-700" : ["cancelled", "returned", "failed"].includes(order.status) ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700")}>{order.status.replaceAll("_", " ")}</span>
                      <span className="text-slate-600">{order.deliveryError && !order.delivery.status ? "Tracking unavailable" : orderDeliveryLabel(order.delivery)}</span>
                    </div>
                    {order.deliveryError ? <p className="mt-2 text-xs text-amber-700">Latest delivery tracking is unavailable. Open the order for details.</p> : null}
                  </div>
                  <div className="hidden text-right sm:block"><p className="font-semibold text-slate-800">{order.total === null ? "Total unavailable" : formatCurrency(order.total)}</p><p className="mt-1 text-xs capitalize text-slate-500">Payment: {order.paymentStatus.replaceAll("_", " ")}</p></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <span className="text-sm font-semibold text-slate-800 sm:hidden">{order.total === null ? "Total unavailable" : formatCurrency(order.total)} <span className="text-xs font-normal capitalize text-slate-500">? Payment: {order.paymentStatus.replaceAll("_", " ")}</span></span>
                  <Link href={'/dashboard/orders/' + encodeURIComponent(order.id)} className="text-sm font-semibold text-brand">View order ?</Link>
                  <div className="flex flex-wrap gap-2">{["delivered", "confirmed"].includes(order.status) ? <ReviewDraftButton orderId={order.id} /> : null}{order.paymentStatus === "pending" && order.status !== "cancelled" ? <Button onClick={() => payOrder(order)}>Resume payment</Button> : null}</div>
                </div>
              </article>
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
