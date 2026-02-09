"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Badge, Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type WishlistItem = {
  id: string;
  name: string;
  price: string;
  inStock: boolean;
  alert?: string;
};

export default function WishlistPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-wishlist"],
    queryFn: () => fetcher<WishlistItem[]>("/dashboard/wishlist"),
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load wishlist."}
        onRetry={refetch}
      />
    );
  }

  return (
    <Card>
      <SectionTitle title="Wishlist" subtitle="Items you saved for later." />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {data.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 p-4 text-sm"
          >
            <div>
              <div className="font-semibold text-slate-800">{item.name}</div>
              <div className="text-slate-500">{item.price}</div>
              <div className="mt-2">
                <Badge tone={item.inStock ? "success" : "warning"}>
                  {item.inStock ? "In stock" : "Low stock"}
                </Badge>
                {item.alert ? (
                  <div className="mt-1 text-xs text-amber-600">{item.alert}</div>
                ) : null}
              </div>
            </div>
            <Button variant="primary">Add to Cart</Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
