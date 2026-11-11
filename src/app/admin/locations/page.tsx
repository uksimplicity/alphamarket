"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { locationRows, type SupportedLocation } from "@/components/products/supportedLocations";

async function request(path = "", method = "GET", body?: Record<string, unknown>, signal?: AbortSignal) {
  const stamp = accountStamp(), token = getAuth()?.access_token?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Sign in as an admin to manage locations.");
  const response = await fetch(`/api/admin/ad-locations${path}`, {
    method, cache: "no-store", redirect: "error",
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json();
  checkAccount(stamp);
  if (!response.ok || payload?.success === false) throw new Error(typeof payload?.error === "string" ? payload.error : "The location request failed.");
  return payload;
}

async function readLocations(signal?: AbortSignal) {
  const locations = new Map<string, SupportedLocation>();
  for (let offset = 0; offset < 10000; offset += 100) {
    const rows = locationRows(await request(`?limit=100&offset=${offset}`, "GET", undefined, signal));
    if (!rows) throw new Error("The location list could not be read.");
    for (const row of rows) locations.set(row.id, row);
    if (rows.length < 100) return [...locations.values()];
  }
  throw new Error("The location list is too large to load. Ask support to review the directory.");
}

function LocationEditor() {
  const [name, setName] = useState("");
  const [type, setType] = useState("city");
  const [parent, setParent] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const lock = useRef(false);
  const auth = getAuth();
  const query = useQuery({ queryKey: ["admin-ad-locations", auth?.user?.id, auth?.access_token], queryFn: ({ signal }) => readLocations(signal), retry: false, refetchOnWindowFocus: false });
  const rows = query.data ?? [];
  const busy = saving || query.isFetching;
  const disabled = busy || uncertain || !!query.error || !query.data;
  const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-50";
  const buttonClass = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50";

  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    try {
      const result = await query.refetch();
      if (!result.isError) { setUncertain(false); setError(""); }
    } finally { lock.current = false; }
  }

  async function write(body: Record<string, unknown>, existing?: SupportedLocation) {
    if (lock.current || disabled) return;
    lock.current = true; setSaving(true); setError(""); setSuccess("");
    try {
      await request(existing ? `/${encodeURIComponent(existing.id)}` : "", existing ? "PUT" : "POST", body);
      const result = await query.refetch();
      if (result.isError) throw new Error("The saved locations could not be refreshed.");
      const saved = result.data?.find(row => existing ? row.id === existing.id : row.name.trim().toLowerCase() === name.trim().toLowerCase() && row.type === type && (row.parent_id || "") === parent);
      if (!saved || saved.is_active !== (existing ? body.is_active : true)) throw new Error("The saved location could not be confirmed.");
      if (!existing) { setName(""); setParent(""); }
      setSuccess(existing ? `${saved.name} ${saved.is_active ? "activated" : "deactivated"}.` : `${saved.name} added.${type === "city" ? " Sellers can now publish products in this city." : ""}`);
    } catch (error) {
      setUncertain(true);
      setError(`${error instanceof Error ? error.message : "The save result is unknown."} Refresh locations before saving again.`);
    } finally { lock.current = false; setSaving(false); }
  }

  return <div className="grid gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-slate-900">Product locations</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Add the cities where sellers can list products. Sellers enter their city when creating a product; active city records supply its region automatically.</p></div><button type="button" className={buttonClass} disabled={busy} onClick={() => void refresh()}>Refresh locations</button></div>
    {(error || query.error) && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error || query.error?.message}</p>}
    {success && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</p>}
    <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3" onSubmit={event => { event.preventDefault(); void write({ name: name.trim(), type, ...(parent ? { parent_id: parent } : {}) }); }}>
      <h2 className="text-lg font-semibold sm:col-span-3">Add a location</h2>
      <label className="text-sm font-medium">Name<input required maxLength={150} value={name} disabled={disabled} onChange={event => setName(event.target.value)} placeholder="e.g. Warri" className={inputClass} /></label>
      <label className="text-sm font-medium">Type<select value={type} disabled={disabled} onChange={event => { setType(event.target.value); setParent(""); }} className={inputClass}>{["country", "state", "city", "area"].map(value => <option key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</option>)}</select></label>
      <label className="text-sm font-medium">Parent location<select value={parent} disabled={disabled || type === "country"} onChange={event => setParent(event.target.value)} className={inputClass}><option value="">No parent</option>{rows.filter(row => row.type === ({ state: "country", city: "state", area: "city" } as Record<string, string>)[type]).map(row => <option key={row.id} value={row.id}>{row.name}{row.is_active === false ? " (inactive)" : ""}</option>)}</select></label>
      <div className="sm:col-span-3"><button className={buttonClass} disabled={disabled || !name.trim()} type="submit">{saving ? "Saving..." : "Add active location"}</button><p className="mt-2 text-xs text-slate-500">Create countries and states first if you want to group cities by region.</p></div>
    </form>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Saved locations</h2><label className="text-sm">Search<input type="search" value={search} onChange={event => setSearch(event.target.value)} className={inputClass} /></label></div>
      {query.isLoading ? <p role="status">Loading locations...</p> : !rows.length && !query.error ? <p className="text-sm text-slate-500">No locations yet. Add an active city above to enable product creation there.</p> : <ul className="divide-y divide-slate-100">{rows.filter(row => row.name.toLowerCase().includes(search.toLowerCase())).map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium text-slate-900">{row.name}</p><p className="text-sm capitalize text-slate-500">{row.type || "Location"}{row.parent_id ? ` / ${rows.find(parent => parent.id === row.parent_id)?.name || "Parent region"}` : ""} · {row.is_active === true ? "Active" : row.is_active === false ? "Inactive" : "Status unavailable"}</p></div>{typeof row.is_active === "boolean" && <button type="button" disabled={disabled} className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50" onClick={() => void write({ is_active: !row.is_active }, row)}>{row.is_active ? "Deactivate" : "Activate"}</button>}</li>)}</ul>}
    </section>
  </div>;
}

export default function AdminLocationsPage() {
  const user = useAuthUser();
  if (!user?.id) return <p role="status">Sign in as an admin to manage locations.</p>;
  return <LocationEditor key={user.id + ":" + getAuth()?.access_token} />;
}
