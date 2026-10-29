"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useBuyerOrders } from "@/components/commerce/buyerOrders";
import {
  formatCurrency,
} from "@/components/commerce/store";
import { Badge, Card, ErrorState, SectionTitle } from "@/components/dashboard/ui";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { orders, loading, error, reload } = useBuyerOrders(params.id);
  const order = orders[0];
  if (loading) return <p>Loading order...</p>;
  if (error) return <ErrorState message={error} onRetry={reload} />;

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
            {order.total === null ? "Total unavailable" : `Total ${formatCurrency(order.total)}`}
          </span>
          <span className="text-xs text-slate-500">Placed {order.createdAt}</span>
          <Badge>Payment: {order.paymentStatus}</Badge>
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
              <span>{product.price === null ? "" : formatCurrency(product.price * product.qty)}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Delivery Address" />
        <p className="mt-3 text-sm text-slate-600">{order.address}</p>
      </Card>

      <Link href="/dashboard/orders" className="text-sm font-semibold text-brand">Back to orders</Link>
    </div>
  );
}
