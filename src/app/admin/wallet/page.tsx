"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuth } from "@/components/auth/authStorage";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminWalletPage() {
  const authUserId = useMemo(() => String(getAuth()?.user?.id ?? ""), []);
  const [userId, setUserId] = useState(authUserId);
  const [txType, setTxType] = useState("credit");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [creditPayload, setCreditPayload] = useState({ amount: "", referenceId: "", referenceType: "manual_adjustment", description: "" });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-wallet-list"],
    queryFn: async () => {
      const payload = await adminFetcher<unknown>("/admin_wallet/list?limit=20&offset=0");
      return asArray(payload).map((row, index) => {
        const record = asRecord(row);
        return {
          id: pickString(record, ["id", "wallet_id"], `wallet-${index}`),
          owner: pickString(record, ["user_id", "owner_id"], "-"),
          balance: pickString(record, ["balance", "available_balance"], "0"),
          status: pickString(record, ["status"], "unknown"),
        };
      });
    },
  });

  async function fetchBalance() {
    if (!userId.trim()) {
      setMessage("User ID is required.");
      return;
    }
    try {
      setMessage("");
      const payload = await adminFetcher<unknown>(`/admin_wallet/balance?user_id=${encodeURIComponent(userId.trim())}`);
      setResult(pretty(payload));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to fetch wallet balance.");
    }
  }

  async function fetchStats() {
    if (!userId.trim()) {
      setMessage("User ID is required.");
      return;
    }
    try {
      setMessage("");
      const payload = await adminFetcher<unknown>(`/admin_wallet/stats?user_id=${encodeURIComponent(userId.trim())}`);
      setResult(pretty(payload));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to fetch wallet stats.");
    }
  }

  async function fetchTransactions() {
    if (!userId.trim()) {
      setMessage("User ID is required.");
      return;
    }
    try {
      setMessage("");
      const payload = await adminFetcher<unknown>(`/admin_wallet/transactions?user_id=${encodeURIComponent(userId.trim())}&limit=20&offset=0`);
      setResult(pretty(payload));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to fetch transactions.");
    }
  }

  async function fetchTransactionsByType() {
    if (!userId.trim()) {
      setMessage("User ID is required.");
      return;
    }
    try {
      setMessage("");
      const payload = await adminFetcher<unknown>(`/admin_wallet/transactions/filter?user_id=${encodeURIComponent(userId.trim())}&type=${encodeURIComponent(txType)}&limit=20&offset=0`);
      setResult(pretty(payload));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to fetch filtered transactions.");
    }
  }

  async function creditWallet() {
    if (!userId.trim()) {
      setMessage("User ID is required.");
      return;
    }

    try {
      setMessage("");
      const payload = await adminFetcher<unknown>(`/admin_wallet/credit?user_id=${encodeURIComponent(userId.trim())}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId.trim(),
          amount: Number(creditPayload.amount || 0),
          reference_id: creditPayload.referenceId || `manual-${Date.now()}`,
          reference_type: creditPayload.referenceType || "manual_adjustment",
          description: creditPayload.description,
        }),
      });
      setResult(pretty(payload));
      setMessage("Wallet credited successfully.");
      await refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to credit wallet.");
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load wallet data."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="Admin Wallets" subtitle="Wallet list and user-scoped wallet actions." />
        <div className="mt-3 flex gap-2">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="user_id" value={userId} onChange={(event) => setUserId(event.target.value)} />
          <Button variant="ghost" onClick={fetchBalance}>Balance</Button>
          <Button variant="ghost" onClick={fetchStats}>Stats</Button>
          <Button variant="ghost" onClick={fetchTransactions}>Transactions</Button>
        </div>
        <div className="mt-3 flex gap-2">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="type" value={txType} onChange={(event) => setTxType(event.target.value)} />
          <Button variant="ghost" onClick={fetchTransactionsByType}>Filter Transactions</Button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          {data?.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-4">
              <div>{row.id}</div>
              <div>{row.owner}</div>
              <div>{row.balance}</div>
              <div>{row.status}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Credit Wallet" subtitle="Manual wallet credit for admin/testing operations." />
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="amount" value={creditPayload.amount} onChange={(event) => setCreditPayload((prev) => ({ ...prev, amount: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="reference_id" value={creditPayload.referenceId} onChange={(event) => setCreditPayload((prev) => ({ ...prev, referenceId: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="reference_type" value={creditPayload.referenceType} onChange={(event) => setCreditPayload((prev) => ({ ...prev, referenceType: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="description" value={creditPayload.description} onChange={(event) => setCreditPayload((prev) => ({ ...prev, description: event.target.value }))} />
        </div>
        <div className="mt-3">
          <Button onClick={creditWallet}>Credit Wallet</Button>
        </div>
        {message ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{message}</div>
        ) : null}
        <pre className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{result || "Wallet response will appear here."}</pre>
      </Card>
    </div>
  );
}
