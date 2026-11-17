"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { authGeneration, getAuth } from "@/components/auth/authStorage";
import { adminFetcher } from "@/components/admin/api";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { parseAdminWallets, walletBalance, walletCreditAmount } from "@/components/admin/walletData";
import { accountStamp, checkAccount, readAccountData, writeAccountData } from "@/components/commerce/localAccountData";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function WalletWorkspace() {
  const user = useAuthUser();
  const authUserId = useMemo(() => String(getAuth()?.user?.id ?? ""), []);
  const [offset, setOffset] = useState(0);
  const [userId, setUserId] = useState(authUserId);
  const [txType, setTxType] = useState("credit");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [creditPayload, setCreditPayload] = useState({ amount: "", referenceId: "", referenceType: "manual_adjustment", description: "" });
  const [selection, setSelection] = useState<{ user_id: string; amount: number; reference_id: string; reference_type: string; description: string; stamp: string; currency: string } | null>(null);
  const [submitting, setSubmitting] = useState(false), [uncertain, setUncertain] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null), lock = useRef(false), creditRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    try { setUncertain(readAccountData("admin-credit-review", () => false, (value): value is boolean => typeof value === "boolean")); }
    catch (failure) { setMessage(failure instanceof Error ? failure.message : "Credit recovery status could not be read."); }
    return () => creditRequest.current?.abort();
  }, []);
  useEffect(() => { if (selection) dialog.current?.showModal(); else dialog.current?.close(); }, [selection]);

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
    if (lock.current || uncertain) return;
    try {
      if (!userId.trim()) throw new Error("User ID is required.");
      const amount = walletCreditAmount(creditPayload.amount);
      const reference_id = creditPayload.referenceId.trim() || `manual-${crypto.randomUUID()}`;
      setCreditPayload(previous => ({ ...previous, referenceId: reference_id }));
      setSelection({ user_id: userId.trim(), amount, reference_id, reference_type: creditPayload.referenceType.trim() || "manual_adjustment", description: creditPayload.description.trim(), stamp: accountStamp(), currency: data?.find(row => row.owner === userId.trim())?.currency || "Wallet currency" });
      setMessage("");
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Check the credit details."); }
  }
  async function confirmCredit() {
    if (!selection || lock.current || uncertain) return;
    lock.current = true; setSubmitting(true);
    const controller = new AbortController(); creditRequest.current = controller;
    try {
      checkAccount(selection.stamp);
      writeAccountData("admin-credit-review", true);
      setUncertain(true);
      const { stamp, currency, ...body } = selection;
      void currency;
      const payload = await adminFetcher<unknown>(`/admin_wallet/credit?user_id=${encodeURIComponent(body.user_id)}`, { method: "POST", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]), headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      checkAccount(stamp);
      if (controller.signal.aborted) return;
      if (payload && typeof payload === "object" && "success" in payload && payload.success === false) throw new Error("The wallet service did not confirm the credit.");
      setResult(pretty(payload));
      setMessage("Wallet credited successfully.");
      writeAccountData("admin-credit-review", false); setUncertain(false);
      setSelection(null); setCreditPayload(previous => ({ ...previous, amount: "", referenceId: "" }));
      await refetch();
    } catch (err) { if (!controller.signal.aborted) { setSelection(null); setMessage((err instanceof Error ? err.message : "The credit result could not be confirmed.") + " Check the wallet balance and transactions before another credit."); } }
    finally { lock.current = false; if (!controller.signal.aborted) { setSubmitting(false); creditRequest.current = null; } }
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
          <Button disabled={submitting || uncertain} onClick={creditWallet}>Review credit</Button>
          {uncertain && !submitting ? <div role="alert" className="mt-3 text-sm text-amber-800">A previous credit needs review. Check the balance and transaction history before continuing. <Button variant="ghost" disabled={submitting} onClick={() => { try { writeAccountData("admin-credit-review", false); setUncertain(false); } catch (failure) { setMessage(failure instanceof Error ? failure.message : "Could not save review status."); } }}>I checked balance and transactions</Button></div> : null}
        </div>
        {message ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{message}</div>
        ) : null}
        <pre className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{result || "Wallet response will appear here."}</pre>
        <dialog ref={dialog} aria-labelledby="credit-title" onCancel={event => { if (submitting) event.preventDefault(); else setSelection(null); }} className="w-[calc(100%_-_32px)] max-w-lg rounded-xl border border-slate-200 p-6 backdrop:bg-slate-900/40"><h2 id="credit-title" className="text-lg font-semibold">Confirm wallet credit</h2>{selection ? <dl className="mt-4 grid gap-3 break-words text-sm"><div><dt>User ID</dt><dd>{selection.user_id}</dd></div><div><dt>Amount</dt><dd>{selection.amount.toFixed(2)} {selection.currency}</dd></div><div><dt>Reference</dt><dd>{selection.reference_id}</dd></div><div><dt>Description</dt><dd>{selection.description || "Not provided"}</dd></div></dl> : null}<div className="mt-5 flex justify-end gap-3"><Button variant="ghost" disabled={submitting} onClick={() => setSelection(null)}>Cancel</Button><Button disabled={submitting || uncertain} onClick={() => void confirmCredit()}>{submitting ? "Crediting..." : "Confirm credit"}</Button></div></dialog>
      </Card>
    </div>
  );
}

export default function AdminWalletPage() {
  const user = useAuthUser();
  return user?.id ? <WalletWorkspace key={`${user.id}:${authGeneration()}`} /> : <p>Sign in with your admin account to view wallets.</p>;
}
