"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuth } from "@/components/auth/authStorage";
import { adminFetcher } from "./api";
import { Button } from "@/components/dashboard/ui";
import { mergeRiderAccount, mergeRiderDetails, parseRider, type RiderRecord } from "./riderRecords";

async function fetchRiderDetails(id: string, signal: AbortSignal): Promise<unknown> {
  const token = getAuth()?.access_token;
  const response = await fetch(`/api/marketplace/grpc/riders/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Additional rider details could not be loaded. The information submitted to the queue is shown below.");
  const payload: unknown = await response.json();
  if (payload && typeof payload === "object" && "success" in payload && payload.success === false) {
    throw new Error("Additional rider details are unavailable. The information submitted to the queue is shown below.");
  }
  const detail = parseRider(payload && typeof payload === "object" && "data" in payload ? payload.data : payload);
  if (detail.id && detail.id !== id) throw new Error("The returned profile does not match this rider. Only the information submitted to the queue is shown.");
  return payload;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className={`mt-1 break-words text-sm ${value ? "text-slate-800" : "text-slate-400"}`}>{value || "Not provided"}</dd></div>;
}

export default function RiderVerificationCard({ rider: summary, expanded, onReview, onVerify, pending }: {
  rider: RiderRecord;
  expanded: boolean;
  onReview: () => void;
  onVerify: () => void;
  pending: boolean;
}) {
  const panelId = useId();
  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-rider-details", summary.id],
    queryFn: ({ signal }) => fetchRiderDetails(summary.id, signal),
    enabled: expanded && !!summary.id,
    retry: false,
  });
  const submittedRider = data ? mergeRiderDetails(summary, data) : summary;
  const account = useQuery({
    queryKey: ["admin-rider-account", submittedRider.userId],
    queryFn: async ({ signal }) => {
      const payload = await adminFetcher<unknown>(`/grpc/users/${encodeURIComponent(submittedRider.userId)}`, { signal });
      // Validate the account association inside the query so errors remain local
      // to this card rather than interrupting the verification queue.
      mergeRiderAccount(submittedRider, payload);
      return payload;
    },
    enabled: !!submittedRider.userId,
    retry: false,
  });
  const rider = account.data ? mergeRiderAccount(submittedRider, account.data) : submittedRider;
  const name = rider.name || (account.isFetching ? "Loading registered rider name..." : rider.email || (rider.id ? `Rider ${rider.id}` : "Rider profile unavailable"));
  return <article className="overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold text-slate-900">{name}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800">Awaiting verification</span>
            {rider.availability && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Availability: {rider.availability.replaceAll("_", " ")}</span>}
          </div>
        </div>
        <Button variant="ghost" aria-expanded={expanded} aria-controls={panelId} onClick={onReview}>{expanded ? "Close details" : "Review details"}</Button>
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Email" value={rider.email} />
        <Detail label="Phone" value={rider.phone} />
        <Detail label="Vehicle" value={[rider.vehicleType, rider.vehicleModel].filter(Boolean).join(" · ")} />
        <Detail label="Vehicle number / plate" value={rider.vehiclePlate} />
      </dl>
    </div>
    {expanded && <div id={panelId} className="border-t border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      {account.error && <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p>The registered account details could not be loaded. The rider's submitted KYC information is shown below.</p>
        <button className="mt-2 font-semibold underline" onClick={() => account.refetch()}>Retry account details</button>
      </div>}
      {isFetching && <p role="status" className="mb-4 text-sm text-slate-500">Loading additional rider details…</p>}
      {error && <div role="alert" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <p>{error instanceof Error ? error.message : "Additional rider details are unavailable."}</p>
        <button className="mt-2 font-semibold underline" onClick={() => refetch()}>Retry details</button>
      </div>}
      <h4 className="text-sm font-semibold text-slate-900">Identity &amp; registration</h4>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Full name" value={rider.name} />
        <Detail label="Address" value={rider.address} />
        <Detail label="Licence number" value={rider.licenseNumber} />
        <Detail label="Licence expiry" value={rider.licenseExpiry} />
        <Detail label="National ID / NIN" value={rider.identityNumber} />
        <Detail label="Registration submitted" value={rider.submittedAt} />
        <Detail label="Rider ID" value={rider.id} />
        <Detail label="User ID" value={rider.userId} />
      </dl>
      <h4 className="mt-6 text-sm font-semibold text-slate-900">Verification documents</h4>
      {rider.documents.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {rider.documents.map(document => <li key={document.url}>
          <a href={document.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-blue-700 hover:border-blue-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
            <span className="break-words capitalize">{document.label}</span><span className="shrink-0 text-xs">Open ↗<span className="sr-only"> in a new tab</span></span>
          </a>
        </li>)}
      </ul> : <p className="mt-2 text-sm text-slate-500">No verification documents were returned for this rider.</p>}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
        <p className="max-w-xl text-xs text-slate-500">Review the rider’s identity, vehicle information and submitted documents before verifying.</p>
        <Button disabled={!rider.id || pending || isFetching || account.isFetching} onClick={onVerify}>{pending ? "Verifying…" : "Verify rider"}</Button>
      </div>
    </div>}
  </article>;
}
