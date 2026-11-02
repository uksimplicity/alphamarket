"use client";
import { useEffect, useRef, useState } from "react";
import { accountStamp, checkAccount } from "./localAccountData";
import { deliveryPoint, type DeliveryPoint } from "./addresses";
import { loadGoogleMaps, mapPoint, type GoogleMapApi } from "./googleMapsLoader";
import styles from "./localFeatures.module.css";

function MapPicker({ point, onSelect, onError }: { point: DeliveryPoint | null; onSelect: (point: DeliveryPoint) => void; onError: (message: string) => void }) {
  const element = useRef<HTMLDivElement>(null), select = useRef(onSelect), report = useRef(onError);
  const map = useRef<InstanceType<GoogleMapApi["Map"]> | null>(null);
  const marker = useRef<InstanceType<GoogleMapApi["Marker"]> | null>(null);
  const latestPoint = useRef(point);
  useEffect(() => { select.current = onSelect; report.current = onError; latestPoint.current = point; }, [onSelect, onError, point]);
  useEffect(() => {
    let active = true;
    const listeners: { remove(): void }[] = [];
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
    if (!key) return;
    void loadGoogleMaps(key).then(api => {
      if (!active || !element.current) return;
      const current = latestPoint.current;
      const center = mapPoint(current || { latitude: 6.5244, longitude: 3.3792 });
      const view = new api.Map(element.current, { center, zoom: current ? 16 : 11, streetViewControl: false, mapTypeControl: false });
      const pin = new api.Marker({ map: view, draggable: true, position: center, visible: !!current });
      map.current = view; marker.current = pin;
      const update = (event: { latLng?: { lat(): number; lng(): number } }) => { if (active && event.latLng) { const p = deliveryPoint(String(event.latLng.lat()), String(event.latLng.lng())); if (p) { pin.setPosition(mapPoint(p)); pin.setVisible(true); select.current(p); } } };
      listeners.push(view.addListener("click", update), pin.addListener("dragend", update));
    }).catch(error => { if (active) report.current(error.message); });
    return () => { active = false; listeners.forEach(listener => listener.remove()); marker.current?.setMap(null); marker.current = null; map.current = null; };
  }, []);
  useEffect(() => { if (point && map.current && marker.current) { map.current.setCenter(mapPoint(point)); marker.current.setPosition(mapPoint(point)); marker.current.setVisible(true); } }, [point]);
  return <div ref={element} className={styles.map} aria-label="Delivery map" />;
}

function Picker({ initial, close, onConfirm }: { initial: DeliveryPoint | null; close: () => void; onConfirm: (point: DeliveryPoint) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), alive = useRef(true), request = useRef(0);
  const [point, setPoint] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [stamp] = useState(() => { try { return accountStamp(); } catch { return ""; } });
  useEffect(() => { alive.current = true; dialog.current?.showModal(); return () => { alive.current = false; }; }, []);
  function select(next: DeliveryPoint) { setPoint(next); }
  function locate() {
    if (!navigator.geolocation) { setError("Location access is unavailable. Choose the location on the map."); return; }
    const attempt = ++request.current;
    setBusy(true); setError("");
    navigator.geolocation.getCurrentPosition(position => {
      if (!alive.current || attempt !== request.current) return;
      try { checkAccount(stamp); const next = deliveryPoint(String(position.coords.latitude), String(position.coords.longitude)); if (!next) throw new Error("Your location could not be determined."); select(next); }
      catch (failure) { setError((failure as Error).message); }
      finally { setBusy(false); }
    }, failure => {
      if (!alive.current || attempt !== request.current) return;
      setBusy(false); setError(failure.code === 1 ? "Allow location access in your browser settings, or choose the location on the map." : failure.code === 3 ? "Location took too long. Try again or choose the location on the map." : "Your location is unavailable. Try again or choose the location on the map.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }
  return <dialog ref={dialog} className={styles.dialog} onCancel={event => { event.preventDefault(); close(); }}>
    <div className={styles.dialogHeader}><h2>Delivery location</h2><button type="button" aria-label="Close location picker" onClick={close}>✕</button></div>
    <p className={`${styles.muted} mt-2`}>Check that this point matches the delivery address before using it.</p>
    {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? <MapPicker point={point} onSelect={select} onError={setError} /> : null}
    <button type="button" className={`${styles.button} mt-4`} onClick={locate} disabled={busy}>{busy ? "Finding location..." : "Use my location"}</button>

    {point ? <p role="status" className={styles.point}>Location selected. Confirm that it matches the address.</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <div className={styles.actions}><button type="button" className={`${styles.button} ${styles.primary}`} disabled={!point || busy} onClick={() => { if (!point) return; try { checkAccount(stamp); onConfirm(point); close(); } catch (failure) { setError((failure as Error).message); } }}>Use this delivery point</button><button type="button" className={styles.button} onClick={close}>Cancel</button></div>
  </dialog>;
}
export default function DeliveryLocationButton({ point, onConfirm, disabled = false }: { point: DeliveryPoint | null; onConfirm: (point: DeliveryPoint) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={styles.button} onClick={() => setOpen(true)} disabled={disabled}>Choose delivery location</button>{open ? <Picker initial={point} onConfirm={onConfirm} close={() => setOpen(false)} /> : null}</>;
}
