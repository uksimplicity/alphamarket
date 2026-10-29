"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { getAuth, isSellerRole } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import Icon from "@/components/admin/AdminIcon";
import { maskedAccount, payoutAccount, payoutBanks, payoutData, payoutMoney, payoutSummary, payoutWithdrawal, payoutWithdrawals, record, withdrawalAmount, type PayoutAccount, type Withdrawal } from "../payouts";
import styles from "../sellerPayments.module.css";

type Bank = { code: string; name: string };
type Snapshot = { available: number | null; pending: number | null; account: PayoutAccount | null; withdrawals: Withdrawal[]; banks: Bank[]; errors: string[]; ready: boolean };
type Action = { kind: "account"; account: PayoutAccount } | { kind: "withdraw"; amount: number; account: PayoutAccount } | { kind: "cancel"; withdrawal: Withdrawal } | { kind: "detail"; withdrawal: Withdrawal };
const empty: Snapshot = { available: null, pending: null, account: null, withdrawals: [], banks: [], errors: [], ready: false };
const pageSize = 20;
const message = (error: unknown) => error instanceof Error ? error.message : "The payout request could not be completed.";

export default function VendorPayments() {
  const user = useAuthUser();
  if (!user?.id || !isSellerRole(user.role)) return <section className={styles.page}><div className={styles.panel}><h1>Seller payments</h1><p>Sign in with your seller account to manage payouts.</p><Link to="/login/vendor">Seller sign in</Link></div></section>;
  return <PaymentsWorkspace key={user.id} userId={user.id} />;
}

function PaymentsWorkspace({ userId }: { userId: string }) {
  const lockKey = `alpha.payout-review.v1:${userId}`;
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [bankCode, setBankCode] = useState("");
  const [number, setNumber] = useState("");
  const [resolved, setResolved] = useState<PayoutAccount | null>(null);
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const mutationLock = useRef(false);
  const mounted = useRef(true);
  const loadSequence = useRef(0);
  const resolveSequence = useRef(0);
  const disabled = busy || loading || blocked || !snapshot.ready;
  const accountDisabled = busy || loading || blocked;

  function currentAccount() {
    const auth = getAuth();
    if (auth?.user.id !== userId || !isSellerRole(auth.user.role) || !auth.access_token) throw new Error("Your sign-in has changed. Please sign in again.");
    return auth;
  }
  async function request(path: string, method = "GET", body?: object) {
    const auth = currentAccount();
    const response = await fetch(`/api/payouts/${path}`, {
      method, cache: "no-store", signal: AbortSignal.timeout(25000),
      headers: { Authorization: `Bearer ${auth.access_token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    let payload: unknown = null;
    try { payload = text ? JSON.parse(text) : null; } catch { throw new Error("The payout service returned an unreadable response. Refresh before trying again."); }
    currentAccount();
    const data = record(payload);
    if (!response.ok || data.success === false) throw new Error(typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : `The payout request failed (${response.status}).`);
    return payload;
  }
  function reviewLock(locked: boolean) {
    setBlocked(locked);
    try { if (locked) sessionStorage.setItem(lockKey, "1"); else sessionStorage.removeItem(lockKey); } catch { /* In-memory lock still prevents another action in this view. */ }
  }
  async function load(page: number, clearReview = false) {
    const sequence = ++loadSequence.current;
    setLoading(true);
    const endpoints = ["summary", "account", `withdrawals?limit=${pageSize}&offset=${page}`, "banks"];
    const parsers = [payoutSummary, payoutAccount, payoutWithdrawals, payoutBanks];
    const results = await Promise.allSettled(endpoints.map(async (endpoint, index) => parsers[index](await request(endpoint))));
    if (!mounted.current || sequence !== loadSequence.current) return;
    const errors = results.flatMap((result, index) => result.status === "rejected" ? [`${["Balance", "Payout account", "Withdrawal history", "Bank list"][index]}: ${message(result.reason)}`] : []);
    const summary = results[0].status === "fulfilled" ? results[0].value as ReturnType<typeof payoutSummary> : { available: null, pending: null };
    const ready = results.slice(0, 3).every(result => result.status === "fulfilled");
    setSnapshot({ ...summary, account: results[1].status === "fulfilled" ? results[1].value as PayoutAccount | null : null, withdrawals: results[2].status === "fulfilled" ? results[2].value as Withdrawal[] : [], banks: results[3].status === "fulfilled" ? results[3].value as Bank[] : [], errors, ready });
    setLoading(false);
    if (clearReview && ready) reviewLock(false);
  }

  useEffect(() => {
    mounted.current = true;
    try { setBlocked(sessionStorage.getItem(lockKey) === "1"); } catch { /* No stored review state. */ }
    void load(offset);
    return () => { mounted.current = false; loadSequence.current++; resolveSequence.current++; };
    // The account-keyed workspace is remounted when the signed-in user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);
  useEffect(() => {
    if (action) dialog.current?.showModal(); else dialog.current?.close();
  }, [action]);

  function changeAccount(bank: string, accountNumber: string) {
    resolveSequence.current++;
    setBankCode(bank); setNumber(accountNumber); setResolved(null); setError("");
  }
  async function resolveAccount(event: FormEvent) {
    event.preventDefault();
    if (busy || blocked || !bankCode || !/^\d{10}$/.test(number)) return;
    const sequence = ++resolveSequence.current;
    setBusy(true); setError(""); setResolved(null);
    try {
      const payload = record(payoutData(await request(`resolve?${new URLSearchParams({ bank_code: bankCode, account_number: number })}`)));
      const name = typeof payload.account_name === "string" ? payload.account_name.trim() : "";
      if (!name) throw new Error("The bank did not return an account holder name. Please check your details.");
      if (sequence === resolveSequence.current && mounted.current) setResolved({ number, name, bankCode, bank: snapshot.banks.find(bank => bank.code === bankCode)?.name ?? "" });
    } catch (failure) { if (sequence === resolveSequence.current && mounted.current) setError(message(failure)); }
    finally { if (mounted.current) setBusy(false); }
  }
  function startWithdrawal(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (disabled || !snapshot.account) return;
    try { setAction({ kind: "withdraw", amount: withdrawalAmount(amount, snapshot.available), account: snapshot.account }); }
    catch (failure) { setError(message(failure)); }
  }
  async function showWithdrawal(withdrawal: Withdrawal) {
    if (!withdrawal.id || busy || loading) return;
    setBusy(true); setError("");
    try {
      const detail = payoutWithdrawal(await request(`withdrawals/${encodeURIComponent(withdrawal.id)}`));
      if (!detail.id || detail.id !== withdrawal.id) throw new Error("The withdrawal details could not be verified. Refresh your history.");
      if (mounted.current) setAction({ kind: "detail", withdrawal: detail });
    } catch (failure) { if (mounted.current) setError(message(failure)); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function confirmAction(event: FormEvent) {
    event.preventDefault();
    if (!action || action.kind === "detail" || mutationLock.current || (action.kind === "account" ? accountDisabled : disabled)) return;
    mutationLock.current = true; setBusy(true); setError(""); setNotice("");
    reviewLock(true); // Persist before sending: a reload must not silently replay an uncertain withdrawal.
    try {
      if (action.kind === "account") {
        await request("account", "PUT", { bank_code: action.account.bankCode, account_number: action.account.number });
      } else if (action.kind === "withdraw") {
        withdrawalAmount(String(action.amount), snapshot.available);
        await request("withdrawals", "POST", { amount: action.amount });
      } else {
        if (action.withdrawal.status !== "pending") throw new Error("Only pending withdrawals can be cancelled.");
        await request(`withdrawals/${encodeURIComponent(action.withdrawal.id)}/cancel`, "POST");
      }
      if (!mounted.current) return;
      setNotice(action.kind === "account" ? "Bank account saved. Review your refreshed payout details below." : action.kind === "withdraw" ? "Withdrawal request submitted for approval. Review its status in your history." : "Cancellation request accepted. Your refreshed balance and history show the current result.");
      setAction(null); setResolved(null); setAmount("");
      await load(offset, true);
    } catch (failure) {
      if (mounted.current) { setAction(null); setError(`${message(failure)} Review your account and history, then use Refresh payouts before another action.`); }
    } finally { mutationLock.current = false; if (mounted.current) setBusy(false); }
  }
  const displayDate = (value: string) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }) : "Not reported";

  return <div className={styles.page}>
    <header className={styles.heading}><div><span className={styles.eyebrow}>YOUR MONEY, AT A GLANCE</span><h1>Payments & payouts</h1><p>Manage your bank account and move available earnings to your bank.</p></div><button type="button" onClick={() => { setError(""); void load(offset, true); }} disabled={loading || busy}><Icon name="orders" size={16} />{loading ? "Refreshing..." : "Refresh payouts"}</button></header>
    <div aria-live="polite">{notice ? <p className={styles.success}>{notice}</p> : null}</div>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    {snapshot.errors.length ? <div className={styles.error} role="alert">{snapshot.errors.map(item => <p key={item}>{item}</p>)}</div> : null}
    {blocked ? <p className={styles.warning}>An earlier payout action needs review. Check your saved account and withdrawal history, then select Refresh payouts to reload them before taking another action.</p> : null}
    <section className={styles.metrics} aria-label="Payout balances">
      <div className={`${styles.metric} ${styles.available}`}><span><Icon name="wallet" size={19} />Available to withdraw</span><strong>{loading ? "Loading..." : payoutMoney(snapshot.available)}</strong><small>Available balance reported by the payout service</small></div>
      <div className={styles.metric}><span><Icon name="orders" size={19} />Pending withdrawals</span><strong>{loading ? "Loading..." : payoutMoney(snapshot.pending)}</strong><small>Funds reserved for withdrawal requests</small></div>
      <div className={styles.metric}><span><Icon name="accounts" size={19} />Payout destination</span><strong className={styles.bankValue}>{loading ? "Loading..." : snapshot.account?.bank || (snapshot.account ? "Saved bank account" : "No account connected")}</strong><small>{snapshot.account ? maskedAccount(snapshot.account.number) : "Verify and save a bank account below"}</small></div>
    </section>
    <div className={styles.escrowNote}><Icon name="wallet" size={21} /><p><strong>Escrow and payouts stay separate.</strong> Paid sales may still be held in escrow. Request withdrawals using the available balance shown here. Withdrawal requests reserve funds immediately and wait for admin approval.</p><Link to="/vendor/orders">View orders</Link></div>
    <div className={styles.columns}>
      <section className={styles.panel}><div className={styles.panelHeading}><span className={styles.step}>01</span><div><h2>Payout bank account</h2><p>Check the account holder name before saving.</p></div></div>
        {snapshot.account ? <div className={styles.saved}><span>YOUR SAVED ACCOUNT</span><strong>{snapshot.account.name || "Account holder not reported"}</strong><p>{snapshot.account.bank || "Bank name not reported"} · {maskedAccount(snapshot.account.number)}</p></div> : !loading ? <p className={styles.muted}>No saved payout account was returned.</p> : null}
        <form onSubmit={resolveAccount} className={styles.form}><label>Bank<select value={bankCode} onChange={event => changeAccount(event.target.value, number)} required disabled={busy || loading || blocked || !snapshot.banks.length}><option value="">Select your bank</option>{snapshot.banks.map(bank => <option key={bank.code} value={bank.code}>{bank.name}</option>)}</select></label><label>Account number<input inputMode="numeric" autoComplete="off" pattern="[0-9]{10}" maxLength={10} value={number} onChange={event => changeAccount(bankCode, event.target.value.replace(/\D/g, ""))} placeholder="10-digit account number" required disabled={busy || loading || blocked} /></label><button type="submit" disabled={busy || loading || blocked || !bankCode || number.length !== 10}>{busy && !action ? "Please wait..." : "Verify account"}</button></form>
        {resolved ? <div className={styles.resolved}><span>ACCOUNT HOLDER</span><strong>{resolved.name}</strong><p>{resolved.bank} · {maskedAccount(resolved.number)}</p><button type="button" className={styles.primary} disabled={accountDisabled} onClick={() => setAction({ kind: "account", account: resolved })}>Save payout account</button></div> : null}
      </section>
      <section className={styles.panel}><div className={styles.panelHeading}><span className={styles.step}>02</span><div><h2>Request a withdrawal</h2><p>Send available earnings to your saved bank account.</p></div></div>
        <form onSubmit={startWithdrawal} className={styles.form}><label>Amount (NGN)<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" disabled={disabled || !snapshot.account || snapshot.available === null} required /></label><p className={styles.muted}>Available: <strong>{payoutMoney(snapshot.available)}</strong></p><div className={styles.destination}><span>DESTINATION</span><strong>{snapshot.account?.name || "Connect a bank account first"}</strong><p>{snapshot.account ? `${snapshot.account.bank || "Saved bank"} · ${maskedAccount(snapshot.account.number)}` : "Use the bank verification form to get started."}</p></div><button type="submit" className={styles.primary} disabled={disabled || !snapshot.account || snapshot.available === null || snapshot.available <= 0 || !amount}>Review withdrawal</button><small className={styles.muted}>Amounts are in naira. Your request is subject to available funds and backend approval.</small></form>
      </section>
    </div>
    <section className={styles.panel}><div className={styles.historyHeading}><div><h2>Withdrawal history</h2><p>Track requests, view details, and cancel pending withdrawals.</p></div><span>{snapshot.withdrawals.length ? offset + 1 : 0}–{offset + snapshot.withdrawals.length}</span></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Withdrawal</th><th>Requested</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{!loading ? snapshot.withdrawals.map((withdrawal, index) => <tr key={withdrawal.id || index}><td><span className={styles.id}>{withdrawal.id || "ID not reported"}</span></td><td>{displayDate(withdrawal.created)}</td><td>{payoutMoney(withdrawal.amount)}</td><td><span className={styles.badge} data-status={withdrawal.status}>{withdrawal.status.replaceAll("_", " ")}</span></td><td><button type="button" disabled={!withdrawal.id || busy || loading} onClick={() => void showWithdrawal(withdrawal)}>View details</button>{withdrawal.status === "pending" ? <button type="button" className={styles.cancelLink} disabled={disabled || !withdrawal.id} onClick={() => setAction({ kind: "cancel", withdrawal })}>Cancel request</button> : null}</td></tr>) : null}</tbody></table></div>
      {loading ? <p className={styles.empty}>Loading payout history...</p> : !snapshot.withdrawals.length ? <p className={styles.empty}>{snapshot.errors.some(item => item.startsWith("Withdrawal history:")) ? "Withdrawal history is unavailable. Refresh to try again." : "No withdrawals on this page."}</p> : null}
      <div className={styles.pagination}><button type="button" disabled={offset === 0 || loading || busy} onClick={() => setOffset(value => Math.max(0, value - pageSize))}>Previous</button><span>Page {Math.floor(offset / pageSize) + 1}</span><button type="button" disabled={snapshot.withdrawals.length < pageSize || loading || busy} onClick={() => setOffset(value => value + pageSize)}>Next</button></div>
    </section>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="payout-dialog-title" onCancel={event => { if (busy) event.preventDefault(); else setAction(null); }}>
      {action ? <form onSubmit={confirmAction}><span className={styles.eyebrow}>{action.kind === "detail" ? "WITHDRAWAL RECORD" : "REVIEW BEFORE CONFIRMING"}</span><h2 id="payout-dialog-title">{action.kind === "account" ? "Save this bank account?" : action.kind === "withdraw" ? "Request this withdrawal?" : action.kind === "cancel" ? "Cancel this withdrawal?" : "Withdrawal details"}</h2>
        {action.kind === "account" || action.kind === "withdraw" ? <><strong className={styles.dialogAmount}>{action.kind === "withdraw" ? payoutMoney(action.amount) : action.account.name}</strong><p>{action.account.name}<br />{action.account.bank || "Saved bank"} · {maskedAccount(action.account.number)}</p><p>{action.kind === "withdraw" ? "This amount will be reserved from your wallet while the withdrawal waits for admin approval." : "Future withdrawals will use this destination. Check that the account belongs to you."}</p></> : <><strong className={styles.dialogAmount}>{payoutMoney(action.withdrawal.amount)}</strong><dl><dt>Withdrawal ID</dt><dd>{action.withdrawal.id}</dd><dt>Status</dt><dd>{action.withdrawal.status}</dd><dt>Requested</dt><dd>{displayDate(action.withdrawal.created)}</dd>{action.withdrawal.reference ? <><dt>Reference</dt><dd>{action.withdrawal.reference}</dd></> : null}{action.withdrawal.failure ? <><dt>Reason</dt><dd>{action.withdrawal.failure}</dd></> : null}</dl>{action.kind === "cancel" ? <p>Only a withdrawal that is still pending can be cancelled. Refresh your balance after cancellation to check returned funds.</p> : null}</>}
        <div className={styles.dialogActions}><button type="button" disabled={busy} onClick={() => setAction(null)}>{action.kind === "detail" ? "Close" : "Go back"}</button>{action.kind !== "detail" ? <button type="submit" className={styles.primary} disabled={action.kind === "account" ? accountDisabled : disabled}>{busy ? "Submitting..." : action.kind === "account" ? "Confirm bank account" : action.kind === "withdraw" ? "Confirm withdrawal" : "Confirm cancellation"}</button> : action.withdrawal.status === "pending" ? <button type="button" disabled={disabled} onClick={() => setAction({ kind: "cancel", withdrawal: action.withdrawal })}>Cancel request</button> : null}</div>
      </form> : null}
    </dialog>
  </div>;
}
