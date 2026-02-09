import { Skeleton } from "@/components/dashboard/ui";

export default function OrdersLoading() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-10" />
      <Skeleton className="h-64" />
    </div>
  );
}
