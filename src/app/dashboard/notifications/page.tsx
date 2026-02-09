"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Badge, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: "order" | "promo";
  time: string;
};

export default function NotificationsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-notifications"],
    queryFn: () => fetcher<NotificationItem[]>("/dashboard/notifications"),
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
        message={error instanceof Error ? error.message : "Failed to load notifications."}
        onRetry={refetch}
      />
    );
  }

  return (
    <Card>
      <SectionTitle title="Notifications" subtitle="Order updates and promotions." />
      <div className="mt-4 space-y-4">
        {data.map((item) => (
          <div key={item.id} className="rounded-xl border border-slate-200 p-4 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-800">{item.title}</div>
              <Badge tone={item.type === "order" ? "success" : "warning"}>
                {item.type === "order" ? "Order" : "Promo"}
              </Badge>
            </div>
            <p className="mt-2 text-slate-500">{item.message}</p>
            <div className="mt-2 text-xs text-slate-400">{item.time}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
