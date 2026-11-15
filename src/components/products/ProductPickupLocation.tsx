"use client";

import { useEffect, useState } from "react";
import { deliveryPoint, type DeliveryPoint } from "@/components/commerce/addresses";
import { geocodeDeliveryAddress } from "@/components/commerce/geocodeAddress";
import DeliveryLocationButton from "@/components/commerce/deliveryLocation";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";

export function validPickupPoint(point: DeliveryPoint | null): point is DeliveryPoint {
  return !!point && typeof point.latitude === "number" && typeof point.longitude === "number"
    && !!deliveryPoint(String(point.latitude), String(point.longitude))
    && !(point.latitude === 0 && point.longitude === 0);
}

// The parent keys this component by address so edits discard pending lookups and pins.
export default function ProductPickupLocation({ address, complete, disabled, confirmed, onConfirm }: {
  address: string; complete: boolean; disabled: boolean; confirmed: boolean;
  onConfirm: (point: DeliveryPoint) => void;
}) {
  const [point, setPoint] = useState<DeliveryPoint | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [stamp] = useState(() => { try { return accountStamp(); } catch { return ""; } });

  useEffect(() => {
    if (!complete || disabled || confirmed || point) return;
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true); setError("");
      void (async () => {
        try {
          const stamp = accountStamp();
          const result = await geocodeDeliveryAddress(address, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "");
          if (!active) return;
          checkAccount(stamp);
          if (!validPickupPoint(result)) throw new Error("Choose a valid pickup location on the map.");
          setPoint(result);
        } catch (failure) {
          if (active) setError((failure instanceof Error ? failure.message : "Address lookup failed. Choose the pickup location on the map.").replace(/delivery/g, "pickup"));
        } finally { if (active) setBusy(false); }
      })();
    }, 900);
    return () => { active = false; clearTimeout(timer); };
  }, [address, complete, disabled, confirmed, point, attempt]);

  function confirm(next: DeliveryPoint) {
    try { checkAccount(stamp); } catch { setError("Your account changed. Reload before confirming the pickup location."); return; }
    if (!validPickupPoint(next)) { setError("Choose a valid pickup location on the map."); return; }
    setPoint(next); setBusy(false); setError(""); onConfirm(next);
  }

  return <div className="field full">
    <p>Pickup address: {address || "Complete the address fields above."}</p>
    {!complete ? <p>Complete the house number, street, state and LGA to locate the pickup address.</p> : <>
      {busy && !confirmed ? <p role="status">Locating pickup address...</p> : null}
      {error ? <><p role="status" className="form-error">{error}</p><button type="button" className="btn-outline" disabled={disabled || busy} onClick={() => setAttempt(value => value + 1)}>Retry address lookup</button></> : null}
      {point && !confirmed ? <><p>Address located. Confirm that this is the pickup address, or adjust the point on the map.</p><button type="button" className="btn-outline" disabled={disabled} onClick={() => confirm(point)}>Confirm pickup location</button></> : null}
      <DeliveryLocationButton purpose="product" point={point} disabled={disabled} onConfirm={confirm} />
      {confirmed ? <p role="status">Pickup location confirmed.</p> : <p>Confirm the pickup location before submitting. Use your current location only when you are at the pickup address.</p>}
    </>}
  </div>;
}
