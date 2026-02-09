"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Badge, Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type OrderDetail = {
  id: string;
  status: string;
  vendor: string;
  total: string;
  address: string;
  invoiceUrl: string;
  products: Array<{ name: string; qty: number; price: string }>;
  timeline: Array<{ label: string; time: string }>;
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["order-detail", params.id],
    queryFn: () => fetcher<OrderDetail>(`/dashboard/orders/${params.id}`),
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load order."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title={`Order ${data.id}`} subtitle={`Vendor: ${data.vendor}`} />
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <Badge>{data.status}</Badge>
          <span className="font-semibold text-slate-800">Total {data.total}</span>
          <a className="text-sm font-semibold text-brand" href={data.invoiceUrl}>
            Download Invoice
          </a>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Products" />
        <div className="mt-4 space-y-2 text-sm">
          {data.products.map((product) => (
            <div key={product.name} className="flex justify-between">
              <span>
                {product.name} x{product.qty}
              </span>
              <span>{product.price}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Delivery Address" />
        <p className="mt-3 text-sm text-slate-600">{data.address}</p>
      </Card>

      <Card>
        <SectionTitle title="Status Timeline" />
        <div className="mt-4 space-y-3">
          {data.timeline.map((step, index) => (
            <div key={step.label} className="flex items-start gap-3 text-sm">
              <div className="flex flex-col items-center">
                <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                {index !== data.timeline.length - 1 ? (
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
