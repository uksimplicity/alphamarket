"use client";

import Link from "next/link";
import {
  formatCurrency,
  useOrders,
} from "@/components/commerce/store";
import { Button, Card, SectionTitle } from "@/components/dashboard/ui";

export default function OrdersPage() {
  const orders = useOrders();

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="Orders Timeline" subtitle="Follow your order progress." />
        <div className="mt-4 space-y-4">
          {orders.length === 0 ? (
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
                      {formatCurrency(order.total)}
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
                  {order.timeline.map((step, index) => (
                    <div key={step.label} className="flex items-start gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                        {index !== order.timeline.length - 1 ? (
                          <span className="h-6 w-px bg-slate-200" />
                        ) : null}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{step.label}</div>
                        <div className="text-xs text-slate-500">{step.time}</div>
                      </div>
                      <Button variant="ghost">Reorder</Button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        {orders.length === 0 ? (
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
