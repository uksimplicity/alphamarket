"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type NotificationTemplate = {
  id: string;
  title: string;
  channel: string;
};

type NotificationsData = {
  templates: NotificationTemplate[];
  broadcasts: Array<{ id: string; title: string; status: string; sourceId: string }>;
};

export default function AdminNotificationsPage() {
  const [pendingRiderId, setPendingRiderId] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const [ridersPayload, uploadsPayload] = await Promise.all([
        adminFetcher<unknown>("/riders/unverified?limit=50"),
        adminFetcher<unknown>("/uploads/expired?limit=50"),
      ]);

      return {
        broadcasts: asArray(ridersPayload).map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "user_id", "uuid"], `rider-${index}`),
            sourceId: pickString(record, ["id", "user_id", "uuid"]),
            title:
              pickString(record, ["name", "full_name"]) ||
              `${pickString(record, ["first_name"])} ${pickString(record, ["last_name"])}`
                .trim() ||
              pickString(record, ["email"], "Unverified rider"),
            status: pickString(record, ["status"], "awaiting verification"),
          };
        }),
        templates: asArray(uploadsPayload).map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "upload_id", "uuid"], `upload-${index}`),
            title: pickString(record, ["key", "name", "url"], "Expired upload"),
            channel: pickString(record, ["created_at", "updated_at"], "expired"),
          };
        }),
      } satisfies NotificationsData;
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
        message={error instanceof Error ? error.message : "Failed to load notifications."}
        onRetry={refetch}
      />
    );
  }

  async function verifyRider(id: string) {
    if (!id) return;
    try {
      setActionMessage("");
      setPendingRiderId(id);
      await adminFetcher(`/riders/${id}/verify`, { method: "POST" });
      setActionMessage("Rider verified successfully.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to verify rider.");
    } finally {
      setPendingRiderId("");
    }
  }

  return (
    <div className="grid gap-6">
      {actionMessage ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
          {actionMessage}
        </div>
      ) : null}
      <Card>
        <SectionTitle
          title="Rider Verification Queue"
          subtitle="Unverified riders that need admin attention."
          action={<Button>Review Riders</Button>}
        />
        <div className="mt-4 space-y-3 text-sm">
          {data.broadcasts.map((broadcast) => (
            <div
              key={broadcast.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{broadcast.title}</div>
                <div className="text-xs text-slate-500">{broadcast.status}</div>
              </div>
              <Button
                variant="ghost"
                disabled={!broadcast.sourceId || pendingRiderId === broadcast.sourceId}
                onClick={() => verifyRider(broadcast.sourceId)}
              >
                {pendingRiderId === broadcast.sourceId ? "Verifying..." : "Verify"}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Expired Uploads" subtitle="Uploads that exceeded their retention window." />
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
