"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type User = {
  id: string;
  name: string;
  email: string;
  status: string;
  orders: number;
};

export default function AdminUsersPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetcher<User[]>("/admin/users"),
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
        message={error instanceof Error ? error.message : "Failed to load users."}
        onRetry={refetch}
      />
    );
  }

  return (
    <Card>
      <SectionTitle title="Users" subtitle="Activate or suspend accounts." />
      <div className="mt-4 space-y-3 text-sm">
        {data.map((user) => (
          <div
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div>
              <div className="font-semibold text-slate-800">{user.name}</div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
            <div className="text-xs text-slate-500">{user.orders} orders</div>
            <div className="text-xs font-semibold text-brand">{user.status}</div>
            <div className="flex gap-2">
              <Button variant="ghost">Suspend</Button>
              <Button>Activate</Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
