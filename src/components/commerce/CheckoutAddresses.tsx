"use client";
import { useEffect, useRef, useState } from "react";
import SavedAddresses, { AddressEditor } from "./SavedAddresses";
import { accountStamp, checkAccount } from "./localAccountData";
import { deliveryPoint, type SavedAddress } from "./addresses";
import styles from "./localFeatures.module.css";
function AddressDialog({ save, address, contact, latitude, longitude, close, choose }: { save: boolean; address: string; contact: string; latitude: string; longitude: string; close: () => void; choose: (row: SavedAddress) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [stamp] = useState(() => { try { return accountStamp(); } catch { return ""; } });
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  function selected(row: SavedAddress) { try { checkAccount(stamp); choose(row); close(); } catch (failure) { setError((failure as Error).message); } }
  return <dialog ref={dialog} className={styles.dialog} onCancel={event => { event.preventDefault(); close(); }}><div className={styles.dialogHeader}><h2>{save ? "Save delivery address" : "Choose saved address"}</h2><button type="button" aria-label="Close saved addresses" onClick={close}>✕</button></div>{error ? <p role="alert" className={styles.error}>{error}</p> : null}{save ? <AddressEditor initial={{ address, contact, ...(deliveryPoint(latitude, longitude) || {}) }} onSaved={selected} onCancel={close} /> : <SavedAddresses onChoose={selected} />}</dialog>;
}
export default function CheckoutAddresses(props: { address: string; contact: string; latitude: string; longitude: string; disabled: boolean; onChoose: (row: SavedAddress) => void }) {
  const [mode, setMode] = useState<"choose" | "save" | null>(null);
  return <><div className={styles.actions}><button type="button" className={styles.button} disabled={props.disabled} onClick={() => setMode("choose")}>Saved addresses</button><button type="button" className={styles.button} disabled={props.disabled} onClick={() => setMode("save")}>Save address on this browser</button></div>{mode ? <AddressDialog {...props} save={mode === "save"} close={() => setMode(null)} choose={props.onChoose} /> : null}</>;
}
