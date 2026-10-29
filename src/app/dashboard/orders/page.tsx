"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuth } from "@/components/auth/authStorage";
import { useBuyerOrders, type BuyerOrder } from "@/components/commerce/buyerOrders";
import { PENDING_CHECKOUT_KEY } from "@/components/commerce/payments";
import {
  formatCurrency,
} from "@/components/commerce/store";
import { Button, Card, SectionTitle } from "@/components/dashboard/ui";

export default function OrdersPage() {
  const { orders, loading, error, reload } = useBuyerOrders();
  const router = useRouter();
  function payOrder(order: BuyerOrder) {
    const buyerId = getAuth()?.user?.id;
    if (!buyerId) return;
    sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ buyerId, orderIds: [order.id], cartKey: "", submitted: true }));
    router.push("/dashboard/checkout");
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="My Orders" subtitle="Follow your order and payment progress." />
        {loading ? <p className="mt-4 text-sm">Loading orders...</p> : null}
        {error ? <div role="alert" className="mt-4 text-red-700">{error} <Button onClick={reload}>Retry</Button></div> : null}
        <div className="mt-4 space-y-4">
          {!loading && !error && orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              You have no orders yet. Place your first order to see updates here.
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      Order {order.id}
                    </div>
                    <div className="text-xs text-slate-500">
                      Vendor: {order.vendor}
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
                      View Details
                    </Link>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  <p className="text-sm capitalize">Order: {order.status.replaceAll("_", " ")}</p>
                  <p className="text-sm capitalize">Payment: {order.paymentStatus.replaceAll("_", " ")}</p>
                  {order.paymentStatus === "pending" && order.status !== "cancelled" ? <Button onClick={() => payOrder(order)}>Pay with Paystack</Button> : null}
                </div>
              </div>
            ))
          )}
        </div>
        {!loading && !error && orders.length === 0 ? (
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
