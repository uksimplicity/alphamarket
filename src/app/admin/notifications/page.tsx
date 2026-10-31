"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import RiderVerificationCard from "@/components/admin/RiderVerificationCard";
import { parseRider, riderRows } from "@/components/admin/riderRecords";
import { getAuth } from "@/components/auth/authStorage";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

async function loadExpiredUploads() {
  let payload: unknown;
  try {
    payload = await adminFetcher<unknown>("/uploads/expired?limit=50");
  } catch {
    const token = getAuth()?.access_token;
    const response = await fetch("/api/upload/files?folder=expired", {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Failed to load expired uploads (${response.status}).`);
    payload = await response.json();
  }
  return asArray(payload).map((row, index) => {
    const record = asRecord(row);
    return {
      id: pickString(record, ["id", "upload_id", "uuid"], `upload-${index}`),
      title: pickString(record, ["key", "name", "url"], "Expired upload"),
      date: pickString(record, ["created_at", "updated_at"], "expired"),
    };
  });
}

export default function AdminNotificationsPage() {
  const [pendingRiderId, setPendingRiderId] = useState("");
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionFailed, setActionFailed] = useState(false);
  const riders = useQuery({
    queryKey: ["admin-unverified-riders"],
    queryFn: async () => {
      const payload = await adminFetcher<unknown>("/riders/unverified?limit=50");
      const record = asRecord(payload);
      if (record?.success === false) throw new Error(pickString(record, ["error", "message"], "Failed to load riders."));
      return riderRows(payload).map(parseRider);
    },
  });
  const uploads = useQuery({queryKey: ["admin-expired-uploads"], queryFn: loadExpiredUploads});

  async function verifyRider(id: string) {
    if (!id || pendingRiderId) return;
    setActionMessage("");
    setActionFailed(false);
    setPendingRiderId(id);
    try {
      const result = asRecord(await adminFetcher<unknown>(`/riders/${encodeURIComponent(id)}/verify`, { method: "POST" }));
      if (result?.success === false) throw new Error(pickString(result, ["error", "message"], "Failed to verify rider."));
      setActionMessage("Rider verified successfully.");
      setReviewKey("");
      await riders.refetch();
    } catch (error) {
      setActionFailed(true);
      setActionMessage(error instanceof Error ? error.message : "Failed to verify rider.");
    } finally {
      setPendingRiderId("");
    }
  }

  return <div className="grid gap-6">
    {actionMessage && <div role={actionFailed ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${actionFailed ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{actionMessage}</div>}
    <Card>
      <SectionTitle title="Rider Verification Queue" subtitle="Review rider details and documents before approving verification."
        action={<Button disabled={!riders.data?.length} onClick={() => setReviewKey(riders.data?.[0]?.id || "row-0")}>Review Riders</Button>} />
      <div className="mt-5 space-y-4 text-sm">
        {riders.isLoading ? <Skeleton className="h-40" /> : riders.error ? <ErrorState message={riders.error instanceof Error ? riders.error.message : "Failed to load riders."} onRetry={riders.refetch} /> : riders.data?.length ? riders.data.map((rider, index) => {
          const key = rider.id || `row-${index}`;
          const expanded = reviewKey === null ? index === 0 : reviewKey === key;
          return <RiderVerificationCard key={key} rider={rider} expanded={expanded}
            onReview={() => setReviewKey(expanded ? "" : key)} onVerify={() => verifyRider(rider.id)} pending={!!pendingRiderId} />;
        }) : <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-slate-500">No riders are awaiting verification.</p>}
      </div>
    </Card>
    <Card>
      <SectionTitle title="Expired Uploads" subtitle="Uploads that exceeded their retention window." />
      <div className="mt-4 space-y-3 text-sm">
        {uploads.isLoading ? <Skeleton className="h-20" /> : uploads.error ? <ErrorState message={uploads.error instanceof Error ? uploads.error.message : "Failed to load expired uploads."} onRetry={uploads.refetch} /> : uploads.data?.length ? uploads.data.map(upload => <div key={upload.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
          <div className="break-all font-semibold text-slate-800">{upload.title}</div><div className="text-xs text-slate-500">{upload.date}</div>
        </div>) : <p className="text-slate-500">No expired uploads.</p>}
      </div>
    </Card>
  </div>;
}
