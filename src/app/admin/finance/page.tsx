"use client";

import { useState } from "react";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher } from "@/components/admin/api";
import { revenuePeriod, revenueReport } from "@/components/admin/financeReport";
import { parseEscrows } from "@/components/commerce/escrow";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type FinanceData = {
  revenueReport: Array<{ label: string; value: string }>;
  pendingEscrows: Array<{ id: string; recipient: string; amount: string; status: string; category: string }>;
  timedOutEscrows: Array<{ id: string; type: string; amount: string; date: string }>;
};

export default function AdminFinancePage() {
  const user = useAuthUser();
  const [pages, setPages] = useState({ owner: "", pending: 0, timedOut: 0 });
  const pendingOffset = pages.owner === user?.id ? pages.pending : 0;
  const timedOutOffset = pages.owner === user?.id ? pages.timedOut : 0;
  const [processingPayouts, setProcessingPayouts] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-finance", user?.id, pendingOffset, timedOutOffset], enabled: Boolean(user?.id),
    queryFn: async () => {
      const period = revenuePeriod();

      const [revenuePayload, pendingPayload, timedOutPayload] = await Promise.all([
        adminFetcher<unknown>("/reports/revenue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_date: period.startDate,
            end_date: period.endDate,
          }),
        }),
        adminFetcher<unknown>(`/escrows/pending?limit=20&offset=${pendingOffset}`),
        adminFetcher<unknown>(`/escrows/timed-out?limit=20&offset=${timedOutOffset}`),
      ]);

      const pending = parseEscrows(pendingPayload, "pending");
      const timedOut = parseEscrows(timedOutPayload, "timed-out");

      return {
        revenueReport: revenueReport(revenuePayload, period),
        pendingEscrows: pending.map((row, index) => {
          return {
            id: row.id || `pending-${index}`,
            recipient: row.recipient,
            amount: row.amount === null ? "Not reported" : `${row.amount.toLocaleString()} ${row.currency}`,
            status: row.status,
            category: row.category,
          };
        }),
        timedOutEscrows: timedOut.map((row, index) => {
          return {
            id: row.id || `timed-out-${index}`,
            type: row.status,
            amount: row.amount === null ? "Not reported" : `${row.amount.toLocaleString()} ${row.currency}`,
            date: row.createdAt || "Not reported",
          };
        }),
      } satisfies FinanceData;
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
        message={error instanceof Error ? error.message : "Failed to load finance data."}
        onRetry={refetch}
      />
    );
  }

  async function processPayouts() {
    try {
      setActionMessage("");
      setProcessingPayouts(true);
      await adminFetcher("/payouts/process", { method: "POST" });
      setActionMessage("Payout processing started successfully.");
      await refetch();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Payout processing failed.");
    } finally {
      setProcessingPayouts(false);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle
          title="Revenue Reports"
          subtitle="Summary by period."
          action={
            <Button disabled={processingPayouts} onClick={processPayouts}>
              {processingPayouts ? "Processing..." : "Process Payouts"}
            </Button>
          }
        />
        {actionMessage ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {actionMessage}
          </div>
        ) : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.revenueReport.map((entry) => (
            <div
              key={entry.label}
              className="rounded-xl border border-slate-200 p-3 text-sm"
            >
              <div className="text-xs text-slate-500">{entry.label}</div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {entry.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Pending escrows" subtitle="Held-fund records across all categories, 20 per page. These are not completed payouts." />
        <div className="mt-4 space-y-3 text-sm">
          {data.pendingEscrows.map((payout) => (
            <div
              key={payout.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{payout.recipient}</div>
                <div className="text-xs text-slate-500">{payout.category}</div>
                <div className="text-xs text-slate-500">{payout.status}</div>
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {payout.amount}
              </div>
            </div>
          ))}
        </div>
        {!data.pendingEscrows.length ? <p className="mt-3 text-sm text-slate-500">No pending escrows on this page.</p> : null}
        <nav aria-label="Pending escrow pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500"><Button variant="ghost" disabled={!pendingOffset} onClick={() => setPages({ owner: user?.id || "", pending: Math.max(0, pendingOffset - 20), timedOut: timedOutOffset })}>Previous</Button><span>Page {pendingOffset / 20 + 1}</span><Button variant="ghost" disabled={data.pendingEscrows.length < 20} onClick={() => setPages({ owner: user?.id || "", pending: pendingOffset + 20, timedOut: timedOutOffset })}>Next</Button></nav>
      </Card>
      <Card>
        <SectionTitle title="Timed-out escrows" subtitle="Records requiring resolution, 20 per page. A timeout does not confirm a refund or release." />
        <div className="mt-4 space-y-3 text-sm">
          {data.timedOutEscrows.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{tx.type}</div>
                <div className="text-xs text-slate-500">{tx.date}</div>
              </div>
              <div className="text-sm font-semibold text-slate-800">
                {tx.amount}
              </div>
            </div>
          ))}
        </div>
        {!data.timedOutEscrows.length ? <p className="mt-3 text-sm text-slate-500">No timed-out escrows on this page.</p> : null}
        <nav aria-label="Timed-out escrow pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-500"><Button variant="ghost" disabled={!timedOutOffset} onClick={() => setPages({ owner: user?.id || "", pending: pendingOffset, timedOut: Math.max(0, timedOutOffset - 20) })}>Previous</Button><span>Page {timedOutOffset / 20 + 1}</span><Button variant="ghost" disabled={data.timedOutEscrows.length < 20} onClick={() => setPages({ owner: user?.id || "", pending: pendingOffset, timedOut: timedOutOffset + 20 })}>Next</Button></nav>
      </Card>
    </div>
  );
}
