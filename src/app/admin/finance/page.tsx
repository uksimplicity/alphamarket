"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asRecord, pickNumber, pickString } from "@/components/admin/api";
import { parseEscrows } from "@/components/commerce/escrow";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type FinanceData = {
  revenueReport: Array<{ label: string; value: string }>;
  pendingEscrows: Array<{ id: string; recipient: string; amount: string; status: string; category: string }>;
  timedOutEscrows: Array<{ id: string; type: string; amount: string; date: string }>;
};

export default function AdminFinancePage() {
  const [processingPayouts, setProcessingPayouts] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-finance"],
    queryFn: async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .slice(0, 10);
      const endDate = now.toISOString().slice(0, 10);

      const [revenuePayload, pendingPayload, timedOutPayload] = await Promise.all([
        adminFetcher<unknown>("/reports/revenue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            start_date: startDate,
            end_date: endDate,
          }),
        }),
        adminFetcher<unknown>("/escrows/pending?limit=20"),
        adminFetcher<unknown>("/escrows/timed-out?limit=20"),
      ]);

      const revenue = asRecord(revenuePayload);
      const pending = parseEscrows(pendingPayload, "pending");
      const timedOut = parseEscrows(timedOutPayload, "timed-out");

      return {
        revenueReport: [
          {
            label: "Period",
            value: `${pickString(revenue, ["start_date"], startDate)} to ${pickString(
              revenue,
              ["end_date"],
              endDate
            )}`,
          },
          {
            label: "Total Revenue",
            value: String(pickNumber(revenue, ["total_revenue"])),
          },
          {
            label: "Total Commission",
            value: String(pickNumber(revenue, ["total_commission"])),
          },
          {
            label: "Total Orders",
            value: String(pickNumber(revenue, ["total_orders"])),
          },
        ],
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
        <SectionTitle title="Pending escrows" subtitle="Held-fund records across all categories, up to 20 loaded. These are not completed payouts." />
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
      </Card>

      <Card>
        <SectionTitle title="Timed-out escrows" subtitle="Records requiring resolution, up to 20 loaded. A timeout does not confirm a refund or release." />
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
      </Card>
    </div>
  );
}
