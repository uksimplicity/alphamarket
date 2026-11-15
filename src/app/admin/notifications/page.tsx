"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import RiderVerificationCard from "@/components/admin/RiderVerificationCard";
import { unverifiedRiders, verifyAndConfirm } from "@/components/admin/riderVerification";
import { RiderVerificationError, verifyRiderRequest } from "@/components/admin/riderClient";
import { authGeneration, getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
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
  const user = useAuthUser();
  const session = `${user?.id || ""}:${authGeneration()}`;
  const [acknowledged, setAcknowledged] = useState<Record<string, string>>({});
  const [pendingRiderId, setPendingRiderId] = useState("");
  const [reviewKey, setReviewKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [actionFailed, setActionFailed] = useState(false);
  const riders = useQuery({
    queryKey: ["admin-unverified-riders", session],
    queryFn: async () => {
      const payload = await adminFetcher<unknown>("/riders/unverified?limit=50");
      return unverifiedRiders(payload);
    },
  });
  const uploads = useQuery({queryKey: ["admin-expired-uploads"], queryFn: loadExpiredUploads});

  async function verifyRider(id: string) {
    if (!id || pendingRiderId || acknowledged[id] === session) return;
    setActionMessage("");
    setActionFailed(false);
    setPendingRiderId(id);
    let stamp: string;
    try { stamp = accountStamp(); } catch (error) {
      setActionFailed(true);
      setActionMessage(error instanceof Error ? error.message : "Sign in again to verify riders.");
      setPendingRiderId("");
      return;
    }
    try {
      const result = await verifyAndConfirm(id, verifyRiderRequest, () => riders.refetch(), () => {
        checkAccount(stamp);
        setAcknowledged(previous => ({ ...previous, [id]: session }));
      });
      checkAccount(stamp);
      setActionMessage(result.message);
      setActionFailed(!result.confirmed);
      setReviewKey("");
    } catch (error) {
      try { checkAccount(stamp); } catch { return; }
      if (error instanceof RiderVerificationError && error.uncertain) setAcknowledged(previous => ({ ...previous, [id]: session }));
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
        action={<div className="flex flex-wrap gap-2"><Button variant="ghost" disabled={riders.isFetching || !!pendingRiderId} onClick={() => void riders.refetch()}>Refresh queue</Button><Button disabled={!riders.data?.length} onClick={() => setReviewKey(riders.data?.[0]?.id || "row-0")}>Review Riders</Button></div>} />
      <div className="mt-5 space-y-4 text-sm">
        {riders.isLoading ? <Skeleton className="h-40" /> : riders.error ? <ErrorState message={riders.error instanceof Error ? riders.error.message : "Failed to load riders."} onRetry={riders.refetch} /> : riders.data?.length ? riders.data.map((rider, index) => {
          const key = rider.id || `row-${index}`;
          const expanded = reviewKey === null ? index === 0 : reviewKey === key;
          return <RiderVerificationCard key={key} rider={rider} expanded={expanded}
            onReview={() => setReviewKey(expanded ? "" : key)} onVerify={() => verifyRider(rider.id)} pending={!!pendingRiderId} verificationPending={acknowledged[rider.id] === session} />;
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
