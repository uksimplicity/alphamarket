"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuth } from "@/components/auth/authStorage";
import { adminFetcher } from "@/components/admin/api";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { parseAdminWallets, walletBalance } from "@/components/admin/walletData";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminWalletPage() {
  const user = useAuthUser();
  const authUserId = useMemo(() => String(getAuth()?.user?.id ?? ""), []);
  const [offset, setOffset] = useState(0);
  const [userId, setUserId] = useState(authUserId);
  const [txType, setTxType] = useState("credit");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [creditPayload, setCreditPayload] = useState({ amount: "", referenceId: "", referenceType: "manual_adjustment", description: "" });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-wallet-list", user?.id, offset],
    queryFn: async () => {
      const payload = await adminFetcher<unknown>(`/admin_wallet/list?limit=20&offset=${offset}`);
      return parseAdminWallets(payload);
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
        <SectionTitle title="Admin Wallets" subtitle="Buyer, seller and rider wallets. Balances use each wallet’s reported currency." action={<Button variant="ghost" onClick={() => void refetch()}>Refresh wallets</Button>} />
        <div className="mt-3 flex gap-2">
          <input aria-label="Wallet owner user ID" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Wallet owner user ID" value={userId} onChange={(event) => { setUserId(event.target.value); setResult(""); setMessage(""); }} />
          <Button variant="ghost" onClick={fetchBalance}>Balance</Button>
          <Button variant="ghost" onClick={fetchStats}>Stats</Button>
          <Button variant="ghost" onClick={fetchTransactions}>Transactions</Button>
        </div>
        <div className="mt-3 flex gap-2">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="type" value={txType} onChange={(event) => setTxType(event.target.value)} />
          <Button variant="ghost" onClick={fetchTransactionsByType}>Filter Transactions</Button>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 text-sm">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr>
              {["Wallet ID", "Owner user ID", "Wallet type", "Balance", "Status", "Actions"].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}
            </tr></thead>
            <tbody>{data?.map(row => <tr key={row.id} className="border-b border-slate-100 last:border-0">
              <td className="break-all px-4 py-4">{row.id}</td>
              <td className="break-all px-4 py-4">{row.owner || "Not reported"}</td>
              <td className="px-4 py-4 capitalize">{row.type}</td>
              <td className="whitespace-nowrap px-4 py-4 font-semibold">{walletBalance(row)}</td>
              <td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs ${row.status === "Active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.status}</span></td>
              <td className="px-4 py-4"><Button variant="ghost" disabled={!row.owner} onClick={() => { setUserId(row.owner); setResult(""); setMessage(""); }}>Select owner</Button></td>
            </tr>)}</tbody>
          </table>
          {!data?.length ? <p className="p-5 text-center text-slate-500">No wallets on this page.</p> : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>Page {Math.floor(offset / 20) + 1} · {data?.length ?? 0} wallets loaded</span>
          <div className="flex gap-2"><Button variant="ghost" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 20))}>Previous</Button><Button variant="ghost" disabled={(data?.length ?? 0) < 20} onClick={() => setOffset(value => value + 20)}>Next</Button></div>
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
