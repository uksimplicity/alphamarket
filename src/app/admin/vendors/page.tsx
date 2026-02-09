"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type Vendor = {
  id: string;
  name: string;
  status: string;
  store: string;
  performance: string;
};

export default function AdminVendorsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: () => fetcher<Vendor[]>("/admin/vendors"),
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
        message={error instanceof Error ? error.message : "Failed to load vendors."}
        onRetry={refetch}
      />
    );
  }

  return (
    <Card>
      <SectionTitle title="Vendors" subtitle="Approve, suspend, and review metrics." />
      <div className="mt-4 space-y-3 text-sm">
        {data.map((vendor) => (
          <div
            key={vendor.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div>
              <div className="font-semibold text-slate-800">{vendor.name}</div>
              <div className="text-xs text-slate-500">{vendor.store}</div>
            </div>
            <div className="text-xs text-slate-500">{vendor.performance}</div>
            <div className="text-xs font-semibold text-brand">{vendor.status}</div>
            <div className="flex gap-2">
              <Button variant="ghost">Suspend</Button>
              <Button>Approve</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
