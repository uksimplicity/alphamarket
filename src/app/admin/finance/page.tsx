"use client";

import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickNumber, pickString } from "@/components/admin/api";
import { Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type FinanceData = {
  revenueReport: Array<{ label: string; value: string }>;
  payouts: Array<{ id: string; vendor: string; amount: string; status: string }>;
  transactions: Array<{ id: string; type: string; amount: string; date: string }>;
};

export default function AdminFinancePage() {
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
      const pending = asArray(pendingPayload);
      const timedOut = asArray(timedOutPayload);

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
        payouts: pending.map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "escrow_id", "order_id"], `pending-${index}`),
            vendor: pickString(
              record,
              ["vendor", "vendor_name", "seller_name", "seller_id"],
              "Pending escrow"
            ),
            amount: String(pickNumber(record, ["amount", "value", "total"], 0)),
            status: pickString(record, ["status", "state"], "pending"),
          };
        }),
        transactions: timedOut.map((row, index) => {
          const record = asRecord(row);
          return {
            id: pickString(record, ["id", "escrow_id", "order_id"], `timed-out-${index}`),
            type: pickString(record, ["status", "state"], "timed_out"),
            amount: String(pickNumber(record, ["amount", "value", "total"], 0)),
            date: pickString(record, ["created_at", "updated_at", "date"], "No date"),
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

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="Revenue Reports" subtitle="Summary by period." />
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
        <SectionTitle title="Payouts" subtitle="Vendor payouts and statuses." />
        <div className="mt-4 space-y-3 text-sm">
          {data.payouts.map((payout) => (
            <div
              key={payout.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 p-4"
            >
              <div>
                <div className="font-semibold text-slate-800">{payout.vendor}</div>
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
        <SectionTitle title="Transactions" subtitle="Latest financial logs." />
        <div className="mt-4 space-y-3 text-sm">
          {data.transactions.map((tx) => (
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
