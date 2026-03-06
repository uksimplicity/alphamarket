"use client";

import Link from "next/link";
import {
  formatCurrency,
  useOrder,
} from "@/components/commerce/store";
import { Badge, Button, Card, ErrorState, SectionTitle } from "@/components/dashboard/ui";

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = useOrder(params.id);

  if (!order) {
    return (
      <div className="grid gap-6">
        <ErrorState message="Order not found." />
        <Link
          href="/dashboard/orders"
          className="text-sm font-semibold text-brand"
        >
          Back to orders
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title={`Order ${order.id}`} subtitle={`Vendor: ${order.vendor}`} />
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <Badge>{order.status}</Badge>
          <span className="font-semibold text-slate-800">
            Total {formatCurrency(order.total)}
          </span>
          <span className="text-xs text-slate-500">Placed {order.createdAt}</span>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Products" />
        <div className="mt-4 space-y-2 text-sm">
          {order.items.map((product) => (
            <div key={product.id} className="flex justify-between">
              <span>
                {product.name} x{product.qty}
              </span>
              <span>{formatCurrency(product.price * product.qty)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Delivery Address" />
        <p className="mt-3 text-sm text-slate-600">{order.address}</p>
      </Card>

      <Card>
        <SectionTitle title="Status Timeline" />
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
      </Card>
    </div>
  );
}
