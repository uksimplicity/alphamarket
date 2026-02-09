"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type CartItem = {
  id: string;
  name: string;
  price: string;
  qty: number;
};

type CartData = {
  items: CartItem[];
  subtotal: string;
};

export default function CartPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-cart"],
    queryFn: () => fetcher<CartData>("/dashboard/cart"),
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
        message={error instanceof Error ? error.message : "Failed to load cart."}
        onRetry={refetch}
      />
    );
  }

  return (
    <Card>
      <SectionTitle title="Cart" subtitle="Manage items before checkout." />
      <div className="mt-4 space-y-4 text-sm">
        {data.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
            <div>
              <div className="font-semibold text-slate-800">{item.name}</div>
              <div className="text-slate-500">
                {item.price} • Qty {item.qty}
              </div>
            </div>
            <Button variant="ghost">Remove</Button>
          </div>
        ))}
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
          <span className="font-semibold text-slate-800">Subtotal</span>
          <span className="font-semibold text-slate-800">{data.subtotal}</span>
        </div>
        <Button>Proceed to Checkout</Button>
      </div>
    </Card>
  );
}
