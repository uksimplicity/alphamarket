"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { adsRequest, fetchPostingCost } from "./client";
import { useAdsMutation, useAdsResource, usePostingCost } from "./hooks";
import { adRecord, amount, canPromote, date, label, money, numeric, record, statusOf, text, userUpdate, type AdRecord } from "./data";
import { collection, Feedback, History, Pager } from "./Common";
import AdEditor from "./AdEditor";
import PostingFee from "./PostingFee";
import AdGallery from "./AdGallery";
import AdPoster from "./AdPoster";
import styles from "./ads.module.css";

const actionLabels: Record<string, string> = { approve: "Approve", reject: "Reject", suspend: "Suspend", unsuspend: "Unsuspend", delete: "Delete", resubmit: "Resubmit" };

export default function AdDetail({ id, admin = false, basePath }: { id: string; admin?: boolean; basePath: string }) {
  const prefix = `${admin ? "/api/admin/ads" : "/api/my-ads"}/${encodeURIComponent(id)}`;
  const resource = useAdsResource(prefix);
  const item = adRecord(resource.data), status = statusOf(item);
  const reviewReason = [item.moderation_reason, item.moderation_note, item.rejection_reason, item.review_note].map(value => text(value).trim()).find(Boolean);
  const [editing, setEditing] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0), [promotionOffset, setPromotionOffset] = useState(0);
  const history = useAdsResource(`${prefix}/${admin ? "moderation-logs" : "history"}?limit=20&offset=${historyOffset}`);
  const promotionResource = useAdsResource(!admin ? `${prefix}/promotions?limit=20&offset=${promotionOffset}` : "");
  const plansResource = useAdsResource(!admin && canPromote(item) ? `${prefix}/promotion-plans` : "");
  const wallet = useAdsResource(!admin ? "/api/wallet/balance" : "");
  const posting = usePostingCost(!admin && status === "rejected" ? userUpdate(item).categoryId : "");
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const [suspension, setSuspension] = useState("permanent"), [hours, setHours] = useState("24"), [until, setUntil] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<AdRecord | null>(null);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const promotionDialog = useRef<HTMLDialogElement>(null);
  const mutation = useAdsMutation();
  const lock = useRef(false);
  const logs = collection(history.data), plans = collection(plansResource.data), promotions = collection(promotionResource.data);
  const walletHref = basePath.startsWith("/vendor") ? "/vendor/wallet" : "/dashboard/wallet";
  const balance = amount(wallet.data, ["balance", "available_balance", "wallet_balance", "wallet"]);
  function refresh() { resource.refresh(); history.refresh(); promotionResource.refresh(); plansResource.refresh(); wallet.refresh(); posting.refresh(); }
  async function act(event: FormEvent) {
    event.preventDefault();
    if (lock.current || mutation.disabled) return;
    if (admin && !["approve", "reject", "suspend", "unsuspend"].includes(action)) { setError("Choose an available moderation action."); return; }
    setError("");
    if (admin && ["reject", "suspend"].includes(action) && !reason.trim()) { setError(action === "reject" ? "Enter a reason for rejection." : "Enter a reason for this decision."); return; }
    if (admin && reason.trim().length > 2000) { setError("Keep your comment within 2,000 characters."); return; }
    lock.current = true;
    try {
      if (!admin && action === "resubmit" && status === "rejected") {
        const cost = await fetchPostingCost(userUpdate(item).categoryId);
        if (!posting.cost || posting.cost.fee !== cost.fee) { posting.refresh(); throw new Error("Review the refreshed posting fee before resubmitting."); }
        if (cost.fee > 0 && (cost.balance === null || cost.balance < cost.fee)) throw new Error("Your wallet balance is too low or unavailable. Fund your wallet and refresh first.");
      }
      const body: AdRecord = admin ? ["approve", "unsuspend"].includes(action) ? { note: reason.trim() } : { reason: reason.trim() } : {};
      if (action === "suspend") {
        if (suspension === "duration") { const duration = Number(hours); if (!Number.isInteger(duration) || duration < 1) throw new Error("Enter a positive number of suspension hours."); body.duration_hours = duration; }
        else if (suspension === "until") { const timestamp = new Date(until); if (!Number.isFinite(timestamp.getTime()) || timestamp.getTime() <= Date.now()) throw new Error("Choose a future suspension end time."); body.until = timestamp.toISOString(); }
        else body.permanent = true;
      }
      const success = await mutation.run(action === "delete" ? prefix : `${prefix}/${action}`, action === "delete" ? "DELETE" : "POST", admin ? body : undefined);
      if (success) { dialog.current?.close(); setReason(""); if (action === "delete") window.location.assign(basePath); else refresh(); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not complete this action."); }
    finally { lock.current = false; }
  }
  async function promote(event: FormEvent) {
    event.preventDefault();
    if (!selectedPlan || lock.current || mutation.disabled) return;
    lock.current = true; setError("");
    try {
      const [currentPlans, currentWallet] = await Promise.all([adsRequest(`${prefix}/promotion-plans`), adsRequest("/api/wallet/balance")]);
      const latest = collection(currentPlans).items.find(plan => plan.id === selectedPlan.id);
      if (!latest || numeric(latest.price) !== numeric(selectedPlan.price)) { plansResource.refresh(); throw new Error("This promotion plan changed. Refresh the plans and review it again."); }
      const price = numeric(latest.price), funds = amount(currentWallet, ["balance", "available_balance", "wallet_balance", "wallet"]);
      if (price === null || price < 0) throw new Error("The plan price is unavailable.");
      if (price > 0 && (funds === null || funds < price)) throw new Error("Insufficient wallet balance. Fund your wallet before purchasing this promotion.");
      if (await mutation.run(`${prefix}/promotions`, "POST", { plan_id: selectedPlan.id })) { promotionDialog.current?.close(); setSelectedPlan(null); refresh(); }
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not purchase this promotion."); }
    finally { lock.current = false; }
  }
  function openAction(value: string) { setAction(value); setReason(""); setError(""); dialog.current?.showModal(); }
  if (resource.loading) return <div className={styles.page}><p role="status">Loading ad…</p></div>;
  if (resource.error || !item.id) return <div className={styles.page}><Feedback error={resource.error || "The ad could not be read."} /><button onClick={resource.refresh}>Retry</button></div>;
  const adminActions = status === "suspended" ? ["unsuspend"] : [...(["pending", "changes_requested"].includes(status) ? ["approve", "reject"] : []), "suspend"];
  return <div className={styles.page}>
    <Link href={basePath}>← {admin ? "Admin Ads" : "My Ads"}</Link><header className={styles.header}><div><h1>{text(item.name)}</h1><span className={styles.badge}>{label(status) || "Status unavailable"}</span>{item.deleted_at ? <span className={styles.badge}>Deleted</span> : null}</div><button onClick={refresh}>Refresh</button></header>
    <Feedback error={mutation.error} message={mutation.message} uncertain={mutation.uncertain} />
    <div className={styles.details}>
      <section className={styles.card}>
        <AdGallery key={id} item={item} />
        <p className={styles.price}>{money(item.base_price ?? item.basePrice)}</p>
        <h2>Ad details</h2>
        <dl className={styles.facts}>
          <div className={styles.factWide}><dt>Description</dt><dd className={styles.description}>{text(item.description ?? item.shortDescription) || "No description provided."}</dd></div>
          <div><dt>Category</dt><dd>{text(record(item.category).name, userUpdate(item).categoryId) || "Unavailable"}</dd></div>
          <div><dt>Supported location</dt><dd>{text(record(item.location).name, userUpdate(item).locationId) || "Unavailable"}</dd></div>
          <div className={styles.factWide}><dt>Address</dt><dd>{text(item.address ?? (typeof item.location === "string" ? item.location : "")) || "Not provided"}</dd></div>
          <div><dt>Stock</dt><dd>{text(item.stock, "Unavailable")}</dd></div>
          <div><dt>Last updated</dt><dd>{date(item.updated_at ?? item.created_at)}</dd></div>
        </dl>
        {admin ? <AdPoster key={id} item={item} /> : null}
        {canPromote(item) ? <Link className={styles.detailLink} href={`/ads/${encodeURIComponent(id)}`}>View public ad</Link> : null}
      </section>
    <section className={`${styles.card} ${styles.moderationCard}`}><h2>{admin ? "Moderation" : "Review feedback"}</h2>{status === "rejected" && reviewReason ? <h3>Reason for rejection</h3> : null}<p className={styles.description}>{reviewReason || "See the moderation history below for decisions and reasons."}</p>{!item.deleted_at ? <div className={styles.actions}>{!admin ? <button disabled={mutation.disabled} onClick={() => setEditing(value => !value)}>Edit ad</button> : null}{admin ? adminActions.map(value => <button key={value} disabled={mutation.disabled} className={value === "delete" || value === "reject" ? styles.danger : ""} onClick={() => openAction(value)}>{actionLabels[value] || label(value.replace(/-/g, " "))}</button>) : <><button className={styles.danger} disabled={mutation.disabled} onClick={() => openAction("delete")}>Delete ad</button>{["rejected", "changes_requested"].includes(status) ? <button disabled={mutation.disabled || (status === "rejected" && (!posting.cost || (posting.cost.fee > 0 && (posting.cost.balance === null || posting.cost.balance < posting.cost.fee))))} className={styles.primary} onClick={() => openAction("resubmit")}>Resubmit for review</button> : null}</>}</div> : null}
      {!admin && status === "rejected" ? <><p className={styles.muted}>The rejected ad’s posting fee was refunded. Resubmission charges the current posting fee again.</p><PostingFee categoryId={userUpdate(item).categoryId} {...posting} walletHref={walletHref} /></> : null}
      {!admin && status === "changes_requested" ? <p className={styles.notice}>Update the ad using the administrator’s feedback, then resubmit it for review.</p> : null}
    </section></div>
    {!admin && editing ? <AdEditor key={`${id}:${text(item.updated_at)}:${status}`} item={item} admin={false} onSaved={() => { setEditing(false); refresh(); }} onCancel={() => setEditing(false)} /> : null}
    <section className={styles.card}><h2>Moderation history</h2><Feedback error={history.error || logs.error} />{history.loading ? <p role="status">Loading history…</p> : <History items={logs.items} />}<Pager offset={historyOffset} count={logs.items.length} total={logs.total} onPage={setHistoryOffset} /></section>
    {!admin ? <section className={styles.card}><h2>Promote your ad</h2><p>Wallet balance: <strong>{money(balance)}</strong> · <Link href={walletHref}>Fund Wallet</Link></p>{canPromote(item) ? <><Feedback error={plansResource.error || plans.error} />{plansResource.loading ? <p>Loading plans…</p> : plans.items.length ? <div className={styles.grid}>{plans.items.map(plan => <div key={text(plan.id)} className={styles.card}><span className={styles.badge}>{label(plan.type)}</span><h3>{text(plan.name)}</h3><p>{text(plan.description)}</p><p>{money(plan.price)} · {text(plan.duration_days)} days</p>{plan.starts_at || plan.start_at ? <p>Starts {date(plan.starts_at ?? plan.start_at)}</p> : null}<button disabled={mutation.disabled || numeric(plan.price) === null || (Number(plan.price) > 0 && (balance === null || balance < Number(plan.price)))} onClick={() => { setSelectedPlan(plan); setError(""); promotionDialog.current?.showModal(); }}>Review purchase</button></div>)}</div> : <p className={styles.empty}>No promotion plans are available for this ad yet.</p>}</> : <p className={styles.notice}>Only approved, published ads can be promoted.</p>}
    <h3>Your promotions</h3><Feedback error={promotionResource.error || promotions.error} />{promotions.items.map((promotion, index) => <div className={styles.log} key={text(promotion.id, String(index))}><strong>{text(promotion.name ?? record(promotion.plan).name ?? promotion.type)}</strong><p>{label(promotion.status)} · {money(promotion.price ?? promotion.amount)}</p><p className={styles.muted}>{date(promotion.starts_at ?? promotion.start_at)} – {date(promotion.ends_at ?? promotion.end_at)}</p></div>)}{!promotionResource.loading && !promotions.items.length ? <p className={styles.muted}>No promotions purchased.</p> : null}<Pager offset={promotionOffset} count={promotions.items.length} total={promotions.total} onPage={setPromotionOffset} /></section> : null}
    <dialog ref={dialog} className={`${styles.card} ${styles.moderationDialog}`} style={{ maxWidth: 540, width: "90%", margin: "auto" }} aria-labelledby="moderation-dialog-title" onCancel={event => { if (mutation.busy) event.preventDefault(); }}><form onSubmit={act}><h2 id="moderation-dialog-title">{actionLabels[action] || label(action.replace(/-/g, " "))} ad</h2>{action === "delete" ? <p>Deleting this ad cancels its running promotions without a refund.</p> : action === "reject" ? <p>Explain why this ad is being rejected. The poster can see this reason in their review feedback and moderation history. The posting fee will be refunded.</p> : action === "resubmit" ? <p>{status === "rejected" ? `Resubmission charges ${money(posting.cost?.fee)} from your wallet.` : "Send your updated ad back for review."}</p> : null}{admin ? <label>{action === "reject" ? "Reason for rejection" : ["approve", "unsuspend"].includes(action) ? "Note (optional)" : "Reason shown to the poster"}<textarea name="reason" rows={5} value={reason} maxLength={2000} disabled={mutation.busy} placeholder={action === "reject" ? "Explain what needs to be corrected before this ad can be approved." : undefined} aria-describedby={action === "reject" ? "rejection-reason-help" : undefined} required={!["approve", "unsuspend"].includes(action)} onChange={event => setReason(event.target.value)} /></label> : null}{admin && action === "reject" ? <p id="rejection-reason-help" className={styles.muted}>Required - {reason.length}/2,000 characters</p> : null}{action === "suspend" ? <><label>Suspension<select value={suspension} onChange={event => setSuspension(event.target.value)}><option value="permanent">Until manually lifted</option><option value="duration">Number of hours</option><option value="until">Until a date and time</option></select></label>{suspension === "duration" ? <label>Hours<input type="number" min={1} step={1} value={hours} onChange={event => setHours(event.target.value)} /></label> : suspension === "until" ? <label>Ends at<input type="datetime-local" value={until} onChange={event => setUntil(event.target.value)} /></label> : null}</> : null}<Feedback error={error || mutation.error} uncertain={mutation.uncertain} /><div className={styles.actions}><button className={styles.primary} type="submit" disabled={mutation.disabled}>{mutation.busy ? "Submitting..." : action === "reject" ? "Reject ad" : `Confirm ${(actionLabels[action] || action).toLowerCase()}`}</button><button type="button" disabled={mutation.busy} onClick={() => dialog.current?.close()}>Cancel</button></div></form></dialog>
    <dialog ref={promotionDialog} className={styles.card} style={{ maxWidth: 500, width: "90%", margin: "auto" }}><form onSubmit={promote}><h2>Purchase promotion</h2><p>{text(selectedPlan?.name)} · {money(selectedPlan?.price)} · {text(selectedPlan?.duration_days)} days</p><p>The price will be deducted from your wallet. A promotion may be queued after a running plan of the same type.</p><Feedback error={error || mutation.error} /><div className={styles.actions}><button type="submit" className={styles.primary} disabled={mutation.disabled}>Pay from wallet</button><button type="button" disabled={mutation.busy} onClick={() => promotionDialog.current?.close()}>Cancel</button></div></form></dialog>
  </div>;
}
