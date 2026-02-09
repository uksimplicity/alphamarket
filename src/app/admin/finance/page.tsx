"use client";

import { useQuery } from "@tanstack/react-query";
import { fetcher } from "@/components/dashboard/api";
import { Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type FinanceData = {
  revenueReport: Array<{ label: string; value: string }>;
  payouts: Array<{ id: string; vendor: string; amount: string; status: string }>;
  transactions: Array<{ id: string; type: string; amount: string; date: string }>;
};

export default function AdminFinancePage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-finance"],
    queryFn: () => fetcher<FinanceData>("/admin/finance"),
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
