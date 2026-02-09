import { Skeleton } from "@/components/dashboard/ui";

export default function HomeLoading() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-28" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
