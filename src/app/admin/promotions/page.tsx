"use client";

import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type PromotionsData = {
  banners: Array<{ id: string; title: string; status: string }>;
  featured: Array<{ id: string; type: string; name: string }>;
  cms: Array<{ id: string; title: string; status: string }>;
};

export default function AdminPromotionsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: async () => {
      const [brandsPayload, categoriesPayload, tagsPayload] = await Promise.all([
        adminFetcher<unknown>("/brands?limit=50"),
        adminFetcher<unknown>("/categories?limit=50"),
        adminFetcher<unknown>("/tags?limit=50"),
      ]);

      return {
        banners: asArray(brandsPayload).map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "uuid"], `brand-${index}`),
            title: pickString(record, ["name", "title"], "Unnamed brand"),
            status: pickString(record, ["slug", "website_url"], "brand"),
          };
        }),
        featured: asArray(categoriesPayload).map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "uuid"], `category-${index}`),
            type: "category",
            name: pickString(record, ["name", "title"], "Unnamed category"),
          };
        }),
        cms: asArray(tagsPayload).map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "uuid"], `tag-${index}`),
            title: pickString(record, ["name", "title"], "Unnamed tag"),
            status: pickString(record, ["slug", "description"], "tag"),
          };
        }),
      } satisfies PromotionsData;
    },
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
          title="Brands"
          subtitle="Brand records from the admin catalog."
          action={<Button>Add Brand</Button>}
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
        <SectionTitle title="Categories" subtitle="Featured catalog categories." />
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
        <SectionTitle title="Tags" subtitle="Promotional taxonomy and labels." />
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
