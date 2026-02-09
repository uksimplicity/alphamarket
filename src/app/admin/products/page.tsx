"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type Product = {
  id: string;
  name: string;
  category: string;
  status: string;
  flagged: boolean;
};

export default function AdminProductsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-products"],
    queryFn: () => fetcher<Product[]>("/admin/products"),
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
        message={error instanceof Error ? error.message : "Failed to load products."}
        onRetry={refetch}
      />
    );
  }

  return (
    <Card>
      <SectionTitle title="Products" subtitle="Approve, reject, and review flagged items." />
      <div className="mt-4 space-y-3 text-sm">
        {data.map((product) => (
          <div
            key={product.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div>
              <div className="font-semibold text-slate-800">{product.name}</div>
              <div className="text-xs text-slate-500">{product.category}</div>
            </div>
            <div className="text-xs font-semibold text-brand">{product.status}</div>
            <div className="text-xs text-slate-500">
              {product.flagged ? "Flagged" : "OK"}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost">Reject</Button>
              <Button>Approve</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
