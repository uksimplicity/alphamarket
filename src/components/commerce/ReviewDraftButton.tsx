"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { accountStamp, checkAccount } from "./localAccountData";
import { discardReviewDraft, readReviewDraft, saveReviewDraft } from "./reviewDrafts";
import styles from "./localFeatures.module.css";
function Editor({ orderId, close }: { orderId: string; close: (saved?: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [rating, setRating] = useState(0), [text, setText] = useState(""), [error, setError] = useState(""), [loaded, setLoaded] = useState(false);
  const [stamp] = useState(() => { try { return accountStamp(); } catch { return ""; } });
  const load = useCallback(() => { try { checkAccount(stamp); const draft = readReviewDraft(orderId); setText(draft?.text || ""); setRating(draft?.rating || 0); setLoaded(true); setError(""); } catch (failure) { setError((failure as Error).message); } }, [stamp, orderId]);
  useEffect(() => { dialog.current?.showModal(); void Promise.resolve().then(load); }, [load]);
  return <dialog ref={dialog} className={styles.dialog} onCancel={event => { event.preventDefault(); close(); }}>
    <div className={styles.dialogHeader}><h2>Leave a review</h2><button type="button" aria-label="Close review" onClick={() => close()}>✕</button></div><p className={`${styles.muted} mt-2`}>Draft · Saved on this browser, not published.</p>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); try { checkAccount(stamp); saveReviewDraft(orderId, { rating, text }); close(true); } catch (failure) { setError((failure as Error).message); } }}>
      <div className={styles.stars} aria-label="Review rating">{[1,2,3,4,5].map(value => <button type="button" key={value} aria-label={`${value} stars`} aria-pressed={value <= rating} disabled={!loaded} onClick={() => setRating(value)}>★</button>)}</div>
      <label>Your review<textarea maxLength={2000} rows={4} value={text} disabled={!loaded} onChange={e => setText(e.target.value)} /></label>{error ? <p role="alert" className={styles.error}>{error}</p> : null}
      <div className={styles.actions}><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={!loaded}>Save draft</button>{!loaded ? <button type="button" className={styles.button} onClick={load}>Retry</button> : null}<button type="button" className={styles.button} onClick={() => { if (window.confirm("Discard the saved review draft for this order?")) { try { checkAccount(stamp); discardReviewDraft(orderId); load(); } catch (failure) { setError((failure as Error).message); } } }}>Discard draft</button></div>
    </form>
  </dialog>;
}
export default function ReviewDraftButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false), [saved, setSaved] = useState(false);
  return <><button type="button" className={styles.button} onClick={() => setOpen(true)}>Leave review</button>{saved ? <span role="status" className={styles.success}>Review draft saved on this browser.</span> : null}{open ? <Editor orderId={orderId} close={didSave => { setOpen(false); if (didSave) setSaved(true); }} /> : null}</>;
}
