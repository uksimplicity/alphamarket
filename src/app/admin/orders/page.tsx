"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

type AdminOrder = {
  id: string;
  customer: string;
  status: string;
  dispute: boolean;
  refund: boolean;
};

export default function AdminOrdersPage() {
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const [pendingPayload, timedOutPayload] = await Promise.all([
        adminFetcher<unknown>("/escrows/pending?limit=50"),
        adminFetcher<unknown>("/escrows/timed-out?limit=50"),
      ]);

      const pending = asArray(pendingPayload).map((row) => ({
        row,
        source: "pending" as const,
      }));
      const timedOut = asArray(timedOutPayload).map((row) => ({
        row,
        source: "timed_out" as const,
      }));

      return [...pending, ...timedOut].map(({ row, source }) => {
        const record = asRecord(row);
        const status =
          pickString(record, ["status", "state"], source === "pending" ? "pending" : "timed_out");
        const loweredStatus = status.toLowerCase();

        return {
          id: pickString(record, ["id", "order_id", "escrow_id", "reference"], "Unknown"),
          customer: pickString(
            record,
            ["customer", "customer_name", "buyer_name", "buyer_email", "user_email"],
            "Customer unavailable"
          ),
          status,
          dispute: loweredStatus.includes("dispute") || source === "timed_out",
          refund: loweredStatus.includes("refund") || loweredStatus.includes("reverse"),
        };
      });
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
        message={error instanceof Error ? error.message : "Failed to load orders."}
        onRetry={refetch}
      />
    );
  }

  async function runEscrowAction(id: string, action: "release" | "reverse") {
    if (!id || id === "Unknown") return;

    try {
      setActionError("");
      setPendingOrderId(id);

      const notes = window.prompt(
        action === "release"
          ? "Optional release notes:"
          : "Reversal notes (required by backend in many setups):",
        ""
      );
      const payload =
        action === "reverse" ? { notes: notes || "Reversed by admin" } : notes ? { notes } : {};

      await adminFetcher(`/escrows/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Escrow action failed.");
    } finally {
      setPendingOrderId(null);
    }
  }

  return (
    <Card>
      <SectionTitle title="Orders" subtitle="Disputes, refunds, and status updates." />
      {actionError ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {actionError}
        </div>
      ) : null}
      <div className="mt-4 space-y-3 text-sm">
        {data.map((order) => (
          <div
            key={order.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div>
              <div className="font-semibold text-slate-800">Order {order.id}</div>
              <div className="text-xs text-slate-500">{order.customer}</div>
            </div>
            <div className="text-xs text-slate-500">{order.status}</div>
            <div className="text-xs text-slate-500">
              {order.dispute ? "Dispute" : "No dispute"}
            </div>
            <div className="text-xs text-slate-500">
              {order.refund ? "Refunded" : "No refund"}
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={pendingOrderId === order.id || order.id === "Unknown"}
                onClick={() => runEscrowAction(order.id, "release")}
              >
                {pendingOrderId === order.id ? "Updating..." : "Release"}
              </Button>
              <Button
                disabled={pendingOrderId === order.id || order.id === "Unknown"}
                onClick={() => runEscrowAction(order.id, "reverse")}
              >
                {pendingOrderId === order.id ? "Updating..." : "Reverse"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
