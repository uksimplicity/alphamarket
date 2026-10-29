"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { canResolveEscrow, escrowActionBody, isEscrowAdmin, parseEscrows, type EscrowAction, type EscrowQueue, type EscrowRecord } from "@/components/commerce/escrow";
import { paymentError } from "@/components/commerce/payments";
import { Badge, Button, Card, ErrorState, SectionTitle } from "@/components/dashboard/ui";

const PAGE_SIZE = 50;
async function escrowRequest(path: string, init?: RequestInit) {
  const token = getAuth()?.access_token;
  if (!token) throw new Error("Sign in with an authorized admin account.");
  const response = await fetch(`/api/admin/escrows/${path}`, {
    ...init, cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${token.replace(/^Bearer\s+/i, "").trim()}`, ...(init?.body ? { "Content-Type": "application/json" } : {}) },
  });
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { throw new Error("The escrow service returned an unreadable result. Refresh before taking another action."); }
  if (!response.ok || payload && typeof payload === "object" && "success" in payload && payload.success === false) throw new Error(paymentError(payload, `Escrow request failed (${response.status}).`));
  return payload;
}
function displayAmount(item: EscrowRecord) {
  if (item.amount === null) return "Not reported";
  try { return new Intl.NumberFormat("en-NG", { style: "currency", currency: item.currency }).format(item.amount); }
  catch { return `${item.amount.toLocaleString()} ${item.currency}`; }
}

export default function AdminEscrowPanel() {
  const user = useAuthUser();
  const authorized = isEscrowAdmin(user?.role);
  const [queue, setQueue] = useState<EscrowQueue>("pending");
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<{ item: EscrowRecord; action: EscrowAction } | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const [blockedId, setBlockedId] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const actionLock = useRef(false);
  const result = useQuery({
    queryKey: ["admin-escrows", user?.id, queue, offset], enabled: authorized, retry: false,
    queryFn: async ({ signal }) => parseEscrows(await escrowRequest(`${queue}?limit=${PAGE_SIZE}&offset=${offset}`, { signal }), queue),
  });
  useEffect(() => {
    const followHash = () => {
      const next: EscrowQueue = window.location.hash === "#timed-out" ? "timed-out" : "pending";
      setQueue(next); setOffset(0); setSearch("");
    };
    followHash(); window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);
  useEffect(() => { if (selection) dialog.current?.showModal(); else dialog.current?.close(); }, [selection]);
  useEffect(() => { setSelection(null); setBlockedId(""); setFeedback(null); }, [user?.id, authorized]);
  const rows = result.data ?? [];
  const filtered = rows.filter(item => [item.id, item.orderId, item.customer, item.recipient, item.category].join(" ").toLowerCase().includes(search.toLowerCase()));
  function choose(item: EscrowRecord, action: EscrowAction) {
    if (!authorized || !canResolveEscrow(item) || submitting || result.isFetching || result.isError || blockedId === item.id) return;
    setNotes(""); setFeedback(null); setSelection({ item, action });
  }
  async function refresh() {
    if (actionLock.current) return;
    const refreshed = await result.refetch();
    if (!refreshed.isError) setBlockedId("");
  }
  async function resolve(event: FormEvent) {
    event.preventDefault();
    if (!selection || actionLock.current || !authorized) return;
    const latest = rows.find(item => item.id === selection.item.id);
    if (!latest || !canResolveEscrow(latest) || result.isFetching || result.isError) {
      setSelection(null); setFeedback({ error: true, text: "This escrow has changed or its status is unavailable. Refresh the queue before continuing." }); return;
    }
    let body: { notes?: string };
    try { body = escrowActionBody(selection.action, notes); }
    catch (err) { setFeedback({ error: true, text: err instanceof Error ? err.message : "Review your notes." }); return; }
    actionLock.current = true; setSubmitting(true); setFeedback(null);
    const { item, action } = selection;
    try {
      // No automatic retry, token refresh replay, or alternative endpoint for a financial action.
      await escrowRequest(`${encodeURIComponent(item.id)}/${action}`, { method: "POST", body: JSON.stringify(body) });
      setSelection(null);
      setFeedback({ error: false, text: `${action === "release" ? "Release" : "Reversal"} accepted for escrow ${item.id}. Check the refreshed queue and order status.` });
      await result.refetch();
    } catch (err) {
      setSelection(null); setBlockedId(item.id);
      setFeedback({ error: true, text: (err instanceof Error ? err.message : "The escrow action could not be confirmed.") + " Refresh the queue before taking another action on this escrow." });
    } finally { actionLock.current = false; setSubmitting(false); }
  }

  return <Card>
    <section id="escrows" className="scroll-mt-24">
      <span id="release-escrow" className="scroll-mt-24" /><span id="reverse-escrow" className="scroll-mt-24" />
      <SectionTitle title="Escrow management" subtitle="Review held funds across all user categories. Release and reversal remain admin actions."
        action={<Button variant="ghost" disabled={!authorized || result.isFetching || submitting} onClick={() => void refresh()}>{result.isFetching ? "Refreshing..." : "Refresh queue"}</Button>} />
      {!authorized ? <p className="mt-4 text-sm text-slate-600">An authorized administrator account is required to view or resolve these escrows.</p> : <>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2" role="group" aria-label="Escrow queue">
            <Button variant={queue === "pending" ? "primary" : "ghost"} aria-pressed={queue === "pending"} disabled={submitting} onClick={() => { setQueue("pending"); setOffset(0); setSearch(""); }}>Pending escrows</Button>
            <Button variant={queue === "timed-out" ? "primary" : "ghost"} aria-pressed={queue === "timed-out"} disabled={submitting} onClick={() => { setQueue("timed-out"); setOffset(0); setSearch(""); }}>Timed-out escrows</Button>
          </div>
          <label className="text-xs text-slate-500">Search this page<input aria-label="Search escrows" className="ml-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700" value={search} onChange={event => setSearch(event.target.value)} placeholder="Escrow, order, category or user" /></label>
        </div>
        {feedback ? <p role={feedback.error ? "alert" : "status"} className={`mt-4 rounded-lg border px-4 py-3 text-sm ${feedback.error ? "border-rose-200 bg-rose-50 text-rose-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{feedback.text}</p> : null}
        {result.isPending ? <p role="status" className="mt-5 text-sm text-slate-500">Loading escrows...</p> : null}
        {result.error ? <div className="mt-4"><ErrorState message={result.error instanceof Error ? result.error.message : "Could not load escrow records."} onRetry={() => void refresh()} /></div> : null}
        {!result.isPending && !result.error && !filtered.length ? <p className="mt-5 rounded-lg border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">{search ? "No matching escrows on this page." : `No ${queue === "pending" ? "pending" : "timed-out"} escrows on this page.`}</p> : null}
        <div className="mt-4 grid gap-3">{filtered.map((item, index) => <article key={`${item.id || item.orderId}-${index}`} className="rounded-lg border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="break-all text-sm font-semibold text-slate-800">Escrow {item.id || "ID not reported"}</p><p className="mt-1 break-all text-xs text-slate-500">Order: {item.orderId || "Not reported"}</p></div><Badge tone={queue === "timed-out" ? "danger" : "warning"}>{item.status.replaceAll("_", " ")}</Badge></div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-xs text-slate-500">Category / source</dt><dd className="mt-1 break-words capitalize text-slate-700">{item.category.replaceAll("_", " ")}</dd></div><div><dt className="text-xs text-slate-500">Customer</dt><dd className="mt-1 break-all text-slate-700">{item.customer}</dd></div><div><dt className="text-xs text-slate-500">Recipient</dt><dd className="mt-1 break-all text-slate-700">{item.recipient}</dd></div><div><dt className="text-xs text-slate-500">Reported escrow amount</dt><dd className="mt-1 text-slate-700">{displayAmount(item)}</dd></div></dl>
          {item.expiresAt ? <p className="mt-3 text-xs text-slate-500">Expiry: {item.expiresAt}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2"><Button variant="ghost" disabled={submitting || result.isFetching || result.isError || !canResolveEscrow(item) || blockedId === item.id} onClick={() => choose(item, "release")}>Release funds</Button><Button variant="ghost" disabled={submitting || result.isFetching || result.isError || !canResolveEscrow(item) || blockedId === item.id} onClick={() => choose(item, "reverse")}>Reverse escrow</Button></div>
          {!item.id ? <p className="mt-2 text-xs text-amber-700">The backend must report an escrow ID before this record can be resolved.</p> : null}
        </article>)}</div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><span>Page {Math.floor(offset / PAGE_SIZE) + 1} · {rows.length} records loaded · all categories</span><div className="flex gap-2"><Button variant="ghost" disabled={!offset || result.isFetching || submitting} onClick={() => setOffset(value => Math.max(0, value - PAGE_SIZE))}>Previous</Button><Button variant="ghost" disabled={rows.length < PAGE_SIZE || result.isFetching || submitting} onClick={() => setOffset(value => value + PAGE_SIZE)}>Next</Button></div></div>
      </>}
    </section>
    <dialog ref={dialog} aria-labelledby="escrow-action-title" onCancel={event => { if (submitting) event.preventDefault(); else setSelection(null); }} className="w-[calc(100%_-_32px)] max-w-lg rounded-xl border border-slate-200 p-6 shadow-xl backdrop:bg-slate-900/40">
      <form onSubmit={resolve}>
        <h2 id="escrow-action-title" className="text-lg font-semibold text-slate-900">{selection?.action === "reverse" ? "Reverse this escrow?" : "Release these funds?"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{selection?.action === "reverse" ? "The backend will reverse the escrow, refund the customer and cancel the associated delivery according to its rules." : "The backend will release the held funds to the eligible recipient. This is separate from confirming that payment was received."}</p>
        <p className="mt-3 break-all text-xs text-slate-500">Escrow ID: {selection?.item.id}</p>
        {selection ? <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><p className="break-all">Order: {selection.item.orderId || "Not reported"}</p><p className="mt-1 break-all">Recipient: {selection.item.recipient}</p><p className="mt-1">Reported amount: {displayAmount(selection.item)}</p></div> : null}
        <label className="mt-4 block text-sm font-medium text-slate-700">{selection?.action === "reverse" ? "Reason for reversal (required)" : "Release notes (optional)"}<textarea autoFocus required={selection?.action === "reverse"} disabled={submitting} value={notes} onChange={event => setNotes(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-slate-300 p-3 text-sm" /></label>
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" disabled={submitting} onClick={() => setSelection(null)}>Cancel</Button><Button type="submit" disabled={submitting || selection?.action === "reverse" && !notes.trim()}>{submitting ? "Submitting..." : selection?.action === "reverse" ? "Confirm reversal" : "Confirm release"}</Button></div>
      </form>
    </dialog>
  </Card>;
}
