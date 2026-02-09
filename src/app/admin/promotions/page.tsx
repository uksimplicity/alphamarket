"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type PromotionsData = {
  banners: Array<{ id: string; title: string; status: string }>;
  featured: Array<{ id: string; type: string; name: string }>;
  cms: Array<{ id: string; title: string; status: string }>;
};

export default function AdminPromotionsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: () => fetcher<PromotionsData>("/admin/promotions"),
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
        message={error instanceof Error ? error.message : "Failed to load promotions."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle
          title="Homepage Banners"
          subtitle="Manage hero banners and rotations."
          action={<Button>Add Banner</Button>}
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.banners.map((banner) => (
            <div
              key={banner.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div className="font-semibold text-slate-800">{banner.title}</div>
              <div className="text-xs text-slate-500">{banner.status}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Featured Items" subtitle="Products and vendors spotlight." />
        <div className="mt-4 space-y-3 text-sm">
          {data.featured.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div className="font-semibold text-slate-800">{item.name}</div>
              <div className="text-xs text-slate-500">{item.type}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="CMS Content" subtitle="Static pages and homepage content." />
        <div className="mt-4 space-y-3 text-sm">
          {data.cms.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div className="font-semibold text-slate-800">{entry.title}</div>
              <div className="text-xs text-slate-500">{entry.status}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
