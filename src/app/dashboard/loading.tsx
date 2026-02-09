import { Skeleton } from "@/components/dashboard/ui";

export default function DashboardLoading() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-20" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
