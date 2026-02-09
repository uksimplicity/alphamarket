"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type Order = {
  id: string;
  status: string;
  vendor: string;
  total: string;
  timeline: Array<{ label: string; time: string }>;
};

export default function OrdersPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-orders"],
    queryFn: () => fetcher<Order[]>("/dashboard/orders"),
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
        message={error instanceof Error ? error.message : "Failed to load orders."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="Orders Timeline" subtitle="Follow your order progress." />
        <div className="mt-4 space-y-4">
          {data.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-800">
                    Order {order.id}
                  </div>
                  <div className="text-xs text-slate-500">Vendor: {order.vendor}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold text-slate-800">
                    {order.total}
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
          ))}
        </div>
      </Card>
    </div>
  );
}
