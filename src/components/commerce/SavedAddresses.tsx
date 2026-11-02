"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "./localAccountData";
import { deleteAddress, deliveryPoint, readAddresses, resetAddresses, saveAddress, type AddressBook, type AddressInput, type SavedAddress } from "./addresses";
import DeliveryLocationButton from "./deliveryLocation";
import { geocodeDeliveryAddress } from "./geocodeAddress";
import styles from "./localFeatures.module.css";

export function AddressEditor({ existing, initial, primary = false, onSaved, onCancel }: { existing?: SavedAddress; initial?: Partial<AddressInput>; primary?: boolean; onSaved: (value: SavedAddress) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(existing?.label ?? initial?.label ?? "Home");
  const [address, setAddress] = useState(existing?.address ?? initial?.address ?? "");
  const [contact, setContact] = useState(existing?.contact ?? initial?.contact ?? "");
  const [latitude, setLatitude] = useState(String(existing?.latitude ?? initial?.latitude ?? ""));
  const [longitude, setLongitude] = useState(String(existing?.longitude ?? initial?.longitude ?? ""));
  const [isDefault, setDefault] = useState(primary), [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const active = useRef(true), savingRef = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [stamp] = useState(() => { try { return accountStamp(); } catch { return ""; } });
  return <form className={styles.form} onSubmit={async event => {
    event.preventDefault(); setError("");
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true);
    try {
      checkAccount(stamp);
      const point = deliveryPoint(latitude, longitude) ?? await geocodeDeliveryAddress(address, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "");
      if (!active.current) return;
      checkAccount(stamp);
      onSaved(saveAddress({ label, address, contact, ...point }, isDefault, existing?.id));
    } catch (failure) { if (active.current) setError((failure as Error).message); }
    finally { savingRef.current = false; if (active.current) setSaving(false); }
  }}>
    <h2>{existing ? "Edit address" : "New address"}</h2><p className={styles.muted}>Saved on this browser for your account.</p>
    <label>Address name<input value={label} disabled={saving} onChange={e => setLabel(e.target.value)} required /></label>
    <label>Full delivery address<textarea autoComplete="street-address" value={address} disabled={saving} onChange={e => { setAddress(e.target.value); setLatitude(""); setLongitude(""); setError(""); }} required /></label>
    <label>Delivery phone<input type="tel" value={contact} disabled={saving} onChange={e => setContact(e.target.value)} /></label>
    <p className={styles.muted}>Your address will be located when you save. You can also choose its exact location on the map.</p>
    <DeliveryLocationButton disabled={saving} point={deliveryPoint(latitude, longitude)} onConfirm={point => { try { checkAccount(stamp); setLatitude(String(point.latitude)); setLongitude(String(point.longitude)); setError(""); } catch (failure) { setError((failure as Error).message); } }} />
    {deliveryPoint(latitude, longitude) ? <p role="status" className={styles.muted}>Delivery location selected.</p> : null}
    <label className={styles.check}><input type="checkbox" checked={isDefault} disabled={saving} onChange={e => setDefault(e.target.checked)} />Make default address</label>
    {saving ? <p role="status" className={styles.muted}>Locating your address...</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <div className={styles.actions}><button type="submit" disabled={saving} className={`${styles.button} ${styles.primary}`}>{saving ? "Saving..." : "Save address"}</button><button type="button" className={styles.button} onClick={() => { active.current = false; onCancel(); }}>Cancel</button></div>
  </form>;
}
function AddressAccount({ onChoose }: { onChoose?: (value: SavedAddress) => void }) {
  const [stamp] = useState(() => { try { return accountStamp(); } catch { return ""; } });
  const [book, setBook] = useState<AddressBook | null>(null), [error, setError] = useState("");
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const load = useCallback(() => { try { checkAccount(stamp); setBook(readAddresses()); setError(""); } catch (failure) { setError((failure as Error).message); } }, [stamp]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  function remove(id?: string) {
    if (!window.confirm(id ? "Delete this saved address from this browser?" : "Reset your saved addresses on this browser?")) return;
    try { checkAccount(stamp); if (id) deleteAddress(id); else resetAddresses(); load(); } catch (failure) { setError((failure as Error).message); }
  }
  return <section className={styles.panel}><h1>Address Book</h1><p className={styles.muted}>Saved on this browser for your account.</p>
    {error ? <div role="alert" className={styles.error}><p>{error}</p><div className={styles.actions}><button type="button" className={styles.button} onClick={load}>Retry</button>{!book ? <button type="button" className={styles.button} onClick={() => remove()}>Reset saved addresses</button> : null}</div></div> : null}
    {editing ? <AddressEditor key={typeof editing === "string" ? "new" : editing.id} existing={typeof editing === "string" ? undefined : editing} primary={typeof editing !== "string" && editing.id === book?.defaultId} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} /> : book ? <>
      {!book.addresses.length ? <p className="py-6">No saved addresses yet.</p> : null}
      {book.addresses.map(row => <article key={row.id} className={styles.address}><strong>{row.label}{row.id === book.defaultId ? " · Default" : ""}</strong><p>{row.address}</p>{row.contact ? <p>{row.contact}</p> : null}<div className={styles.actions}>{onChoose ? <button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => onChoose(row)}>Use address</button> : null}<button type="button" className={styles.button} onClick={() => setEditing(row)}>Edit</button><button type="button" className={styles.button} onClick={() => remove(row.id)}>Delete</button></div></article>)}
      <button type="button" className={`${styles.button} ${styles.primary} mt-5`} onClick={() => setEditing("new")}>Add address</button>
    </> : !error ? <p role="status">Loading saved addresses...</p> : null}
  </section>;
}
export default function SavedAddresses(props: { onChoose?: (value: SavedAddress) => void }) { const user = useAuthUser(); return <AddressAccount key={user?.id || user?.email || "signed-out"} {...props} />; }
