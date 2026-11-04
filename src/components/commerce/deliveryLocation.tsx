"use client";
import { useEffect, useRef, useState } from "react";
import { accountStamp, checkAccount } from "./localAccountData";
import { deliveryPoint, type DeliveryPoint } from "./addresses";
import { loadGoogleMaps, mapPoint, mapsAuthFailureEvent, type GoogleMapApi } from "./googleMapsLoader";
import styles from "./localFeatures.module.css";

function MapPicker({ point, onSelect, onError, purpose }: { point: DeliveryPoint | null; onSelect: (point: DeliveryPoint) => void; onError: (message: string) => void; purpose: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
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
    const fail = (message: string) => { if (active) { setStatus("error"); report.current(message); } };
    const denied = () => fail("The map is unavailable. Use your current location or try again.");
    window.addEventListener(mapsAuthFailureEvent, denied);
    void loadGoogleMaps(key).then(api => {
      if (!active || !element.current) return;
      const current = latestPoint.current;
      const center = mapPoint(current || { latitude: 6.5244, longitude: 3.3792 });
      const view = new api.Map(element.current, { center, zoom: current ? 16 : 11, streetViewControl: false, mapTypeControl: false });
      const pin = new api.Marker({ map: view, draggable: true, position: center, visible: !!current });
      map.current = view; marker.current = pin;
      setStatus("ready");
      const update = (event: { latLng?: { lat(): number; lng(): number } }) => { if (active && event.latLng) { const p = deliveryPoint(String(event.latLng.lat()), String(event.latLng.lng())); if (p) { pin.setPosition(mapPoint(p)); pin.setVisible(true); select.current(p); } } };
      listeners.push(view.addListener("click", update), pin.addListener("dragend", update));
    }).catch(error => fail(error instanceof Error ? error.message : "The map is unavailable."));
    return () => { active = false; window.removeEventListener(mapsAuthFailureEvent, denied); listeners.forEach(listener => listener.remove()); marker.current?.setMap(null); marker.current = null; map.current = null; };
  }, [attempt]);
  useEffect(() => { if (map.current && marker.current) { marker.current.setVisible(!!point); if (point) { map.current.setCenter(mapPoint(point)); marker.current.setPosition(mapPoint(point)); } } }, [point]);
  return <>
    <div ref={element} className={styles.map} aria-label={`${purpose === "product" ? "Product location" : "Delivery"} map`} hidden={status === "error"} />
    {status === "loading" ? <p role="status" className={styles.muted}>Loading map…</p> : null}
    {status === "ready" ? <p className={styles.muted}>Click the map or drag the pin to choose the exact location.</p> : null}
    {status === "error" ? <button type="button" className={styles.button} onClick={() => { setStatus("loading"); report.current(""); setAttempt(value => value + 1); }}>Retry map</button> : null}
  </>;
}

function Picker({ initial, close, onConfirm, purpose }: { initial: DeliveryPoint | null; close: () => void; onConfirm: (point: DeliveryPoint) => void; purpose: "delivery" | "product" }) {
  const dialog = useRef<HTMLDialogElement>(null), alive = useRef(true), request = useRef(0);
  const [point, setPoint] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(""), [mapError, setMapError] = useState("");
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
    <div className={styles.dialogHeader}><h2>{purpose === "product" ? "Product location" : "Delivery location"}</h2><button type="button" aria-label="Close location picker" onClick={close}>✕</button></div>
    <p className={`${styles.muted} mt-2`}>{purpose === "product" ? "Choose where the product is available for pickup." : "Check that this point matches the delivery address before using it."}</p>
    <button type="button" className={`${styles.button} ${styles.primary} mt-4`} onClick={locate} disabled={busy}>{busy ? "Finding location..." : "Use my location"}</button>
    <p className={`${styles.muted} mt-2`}>Your current location works without the map. Use it only if you are at {purpose === "product" ? "the pickup address" : "the delivery address"}, then confirm the selected point.</p>
    {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? <MapPicker point={point} onSelect={select} onError={setMapError} purpose={purpose} /> : <p className={`${styles.muted} mt-2`}>The map preview is unavailable. You can still use and confirm your current location.</p>}
    {mapError ? <p role="status" className={styles.muted}>The map preview could not load. You can still use and confirm your current location.</p> : null}
    {point ? <p role="status" className={styles.point}>Location selected. Confirm that it matches the address.</p> : null}
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <div className={styles.actions}><button type="button" className={`${styles.button} ${styles.primary}`} disabled={!point || busy} onClick={() => { if (!point) return; try { checkAccount(stamp); onConfirm(point); close(); } catch (failure) { setError((failure as Error).message); } }}>{purpose === "product" ? "Use this product location" : "Use this delivery point"}</button><button type="button" className={styles.button} onClick={close}>Cancel</button></div>
  </dialog>;
}
export default function DeliveryLocationButton({ point, onConfirm, disabled = false, purpose = "delivery" }: { point: DeliveryPoint | null; onConfirm: (point: DeliveryPoint) => void; disabled?: boolean; purpose?: "delivery" | "product" }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={styles.button} onClick={() => setOpen(true)} disabled={disabled}>{purpose === "product" ? "Choose product location on map" : "Choose delivery location"}</button>{open ? <Picker initial={point} onConfirm={onConfirm} close={() => setOpen(false)} purpose={purpose} /> : null}</>;
}
