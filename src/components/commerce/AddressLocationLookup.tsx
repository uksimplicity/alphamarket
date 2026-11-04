"use client";

import { useEffect, useRef, useState } from "react";
import { accountStamp, checkAccount } from "./localAccountData";
import { geocodeDeliveryAddress } from "./geocodeAddress";
import type { DeliveryPoint } from "./addresses";
import styles from "./localFeatures.module.css";
import { nigeriaLGAs, nigeriaStates } from "@/data/nigeriaLocations";
import { emptyAddressDetails, fullAddress, readAddressDetails } from "./structuredAddress";

const emptyDetails = emptyAddressDetails;

export default function AddressLocationLookup({ address, point, onLocate, onAddressChange, disabled = false, addressLabel = "Full delivery address", addressId, addressName }: {
  address: string;
  point: DeliveryPoint | null;
  onLocate: (point: DeliveryPoint) => void;
  onAddressChange: (address: string) => void;
  disabled?: boolean;
  addressLabel?: string;
  addressId?: string;
  addressName?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [fields, setFields] = useState({ address: "", ...emptyDetails });
  const details = fields.address === address ? fields : readAddressDetails(address);
  const structured = Object.values({ houseNumber: details.houseNumber, street: details.street, lga: details.lga, state: details.state }).some(value => value.trim());
  const complete = !structured || Boolean(details.street.trim() && details.lga.trim() && details.state.trim());
  const [state, setState] = useState({ address: "", loading: false, error: "" });
  const locate = useRef(onLocate);
  useEffect(() => { locate.current = onLocate; }, [onLocate]);
  const latitude = point?.latitude, longitude = point?.longitude;

  useEffect(() => {
    if (disabled || !complete || !address.trim() || latitude !== undefined && longitude !== undefined) return;
    let active = true;
    // Wait until typing pauses instead of sending a Google request per keystroke.
    const timer = setTimeout(() => {
      setState({ address, loading: true, error: "" });
      void (async () => {
        try {
          const stamp = accountStamp();
          const result = await geocodeDeliveryAddress(address, process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "");
          if (!active) return;
          checkAccount(stamp);
          locate.current(result);
          setState({ address, loading: false, error: "" });
        } catch (failure) {
          if (active) setState({ address, loading: false, error: failure instanceof Error ? failure.message : "We couldn't locate this address. Choose its exact location on the map." });
        }
      })();
    }, 900);
    // Google geocoding cannot be aborted; ignore results after editing, pin/GPS
    // selection, submission, or leaving this form.
    return () => { active = false; clearTimeout(timer); };
  }, [address, latitude, longitude, disabled, attempt, complete]);

  function change(field: keyof typeof emptyDetails, value: string) {
    const next = { houseNumber: details.houseNumber, street: details.street, lga: details.lga, state: details.state, [field]: value };
    if (field === "state") next.lga = "";
    const composed = fullAddress(next);
    setFields({ ...next, address: composed });
    onAddressChange(composed);
  }

  const current = !point && !disabled && state.address === address ? state : null;
  return <div>
    <fieldset disabled={disabled} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <legend className="mb-2 text-sm font-medium">Address details</legend>
      <label>House number<input type="text" value={details.houseNumber} onChange={event => change("houseNumber", event.target.value)} placeholder="e.g. 12B" /></label>
      <label>Street name<input type="text" value={details.street} onChange={event => change("street", event.target.value)} placeholder="e.g. Admiralty Way" /></label>
      <label>State<select className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2" autoComplete="address-level1" value={details.state} onChange={event => change("state", event.target.value)}><option value="">Select state</option>{nigeriaStates.map(state => <option key={state} value={state}>{state}</option>)}</select></label>
      <label>LGA<select className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2" autoComplete="address-level2" disabled={!details.state} value={details.lga} onChange={event => change("lga", event.target.value)}><option value="">{details.state ? "Select local government area" : "Select state first"}</option>{(nigeriaLGAs[details.state] || []).map(lga => <option key={lga} value={lga}>{lga}</option>)}</select></label>
    </fieldset>
    <label className="mt-3 grid min-w-0 gap-2 text-sm">{addressLabel}<textarea className="w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-slate-700" id={addressId} name={addressName} autoComplete="street-address" value={address} readOnly placeholder="Your full address appears here" /></label>
    <p className={styles.muted}>{structured && !complete ? "Complete the street name, LGA and state to locate this address." : "We’ll locate your full address automatically. Use the map to adjust the exact point."}</p>
    {current?.loading ? <p role="status" className={styles.muted}>Locating your address...</p> : null}
    {current?.error ? <><p role="status" className={styles.error}>{current.error}</p><button type="button" className={styles.button} disabled={disabled} onClick={() => setAttempt(value => value + 1)}>Retry address lookup</button></> : null}
  </div>;
}
