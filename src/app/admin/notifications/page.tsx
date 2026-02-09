"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type NotificationTemplate = {
  id: string;
  title: string;
  channel: string;
};

type NotificationsData = {
  templates: NotificationTemplate[];
  broadcasts: Array<{ id: string; title: string; status: string }>;
};

export default function AdminNotificationsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => fetcher<NotificationsData>("/admin/notifications"),
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
    <div className="grid gap-6">
      <Card>
        <SectionTitle
          title="Broadcast Messages"
          subtitle="Send platform-wide announcements."
          action={<Button>New Broadcast</Button>}
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.broadcasts.map((broadcast) => (
            <div
              key={broadcast.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div className="font-semibold text-slate-800">{broadcast.title}</div>
              <div className="text-xs text-slate-500">{broadcast.status}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Templates" subtitle="Reusable notification templates." />
        <div className="mt-4 space-y-3 text-sm">
          {data.templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div className="font-semibold text-slate-800">{template.title}</div>
              <div className="text-xs text-slate-500">{template.channel}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
