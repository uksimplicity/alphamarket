"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type AdminOrder = {
  id: string;
  customer: string;
  status: string;
  dispute: boolean;
  refund: boolean;
};

export default function AdminOrdersPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: () => fetcher<AdminOrder[]>("/admin/orders"),
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
    <Card>
      <SectionTitle title="Orders" subtitle="Disputes, refunds, and status updates." />
      <div className="mt-4 space-y-3 text-sm">
        {data.map((order) => (
          <div
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div>
              <div className="font-semibold text-slate-800">Order {order.id}</div>
              <div className="text-xs text-slate-500">{order.customer}</div>
            </div>
            <div className="text-xs text-slate-500">{order.status}</div>
            <div className="text-xs text-slate-500">
              {order.dispute ? "Dispute" : "No dispute"}
            </div>
            <div className="text-xs text-slate-500">
              {order.refund ? "Refunded" : "No refund"}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost">Force Update</Button>
              <Button>Refund</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
