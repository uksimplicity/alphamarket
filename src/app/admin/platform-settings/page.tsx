"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { parseSettings, sameSettingValue, settingError, settingGroup, settingLabel, type PlatformSetting } from "@/components/admin/platformSettings";
import { Button, Card, ErrorState, Skeleton } from "@/components/dashboard/ui";

async function request(method: "GET" | "PUT", input?: { key: string; value: string }, signal?: AbortSignal) {
  const stamp = accountStamp(), auth = getAuth();
  const response = await fetch("/api/admin/platform-settings", {
    method, cache: "no-store", redirect: "error", signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${auth!.access_token.replace(/^Bearer\s+/i, "").trim()}`, Accept: "application/json", ...(input ? { "Content-Type": "application/json" } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}),
  });
  const payload = await response.json();
  checkAccount(stamp);
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || payload?.message || "The settings request failed.");
  return payload;
}

function SettingsEditor({ adminId }: { adminId: string }) {
  const client = useQueryClient();
  const queryKey = ["admin-platform-settings", adminId];
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [feedback, setFeedback] = useState<{ key: string; text: string; error: boolean } | null>(null);
  const lock = useRef(false);
  const query = useQuery({ queryKey, retry: false, refetchOnWindowFocus: false, queryFn: async ({ signal }) => parseSettings(await request("GET", undefined, signal)) });
  const settings = query.data ?? [];
  const values = Object.fromEntries(settings.map(item => [item.key, item.value]));
  const dirty = settings.filter(item => drafts[item.key] !== undefined && !sameSettingValue(item, drafts[item.key], item.value)).length;

  function edit(key: string, value: string) {
    setDrafts(previous => ({ ...previous, [key]: value }));
    if (feedback?.key === key && !feedback.error) setFeedback(null);
  }

  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    try {
      const result = await query.refetch();
      if (!result.isError) { setUncertain(false); setFeedback(null); }
    } finally { lock.current = false; }
  }

  async function save(item: PlatformSetting) {
    const value = drafts[item.key]?.trim() ?? item.value;
    if (lock.current || uncertain || settingError(item, value, values) || sameSettingValue(item, value, item.value)) return;
    lock.current = true; setSaving(item.key); setFeedback(null);
    try {
      await request("PUT", { key: item.key, value });
      const rows = parseSettings(await request("GET"));
      const saved = rows.find(row => row.key === item.key);
      client.setQueryData(queryKey, rows);
      if (!saved || !sameSettingValue(saved, value, saved.value)) throw new Error("The saved value could not be verified. Refresh saved values before trying again.");
      setDrafts(previous => { const next = { ...previous }; delete next[item.key]; return next; });
      setFeedback({ key: item.key, text: `${settingLabel(item.key)} updated successfully.`, error: false });
      void client.invalidateQueries({ queryKey: ["admin-commission-setting"] });
    } catch (error) {
      setUncertain(true);
      setFeedback({ key: item.key, text: error instanceof Error ? error.message : "The save could not be confirmed. Refresh saved values before retrying.", error: true });
    } finally { lock.current = false; setSaving(null); }
  }

  const groups = ["Commissions", "Escrow & payments", "Delivery pricing"];
  return <div className="grid gap-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">Platform controls</p><h1 className="text-2xl font-semibold text-slate-900">Platform settings</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">Set commissions, payment rules and delivery prices. Edit a value and save it to update the platform.</p></div>
      <Button variant="ghost" disabled={!!saving || query.isFetching} onClick={() => void refresh()}>{query.isFetching ? "Refreshing…" : "Refresh saved values"}</Button>
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[{ label: "Available settings", value: settings.length }, { label: "Unsaved changes", value: dirty }, { label: "Settings groups", value: groups.length }].map(stat => <div key={stat.label} className="rounded-xl border border-slate-200 bg-white px-5 py-4"><p className="text-xs font-medium text-slate-500">{stat.label}</p><p className="mt-1 text-2xl font-semibold text-slate-900">{query.isLoading ? "—" : stat.value}</p></div>)}
    </div>
    {uncertain && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{feedback?.text} Refresh saved values before saving again. Your edits have been kept.</div>}
    {query.error && <ErrorState message={query.error.message} onRetry={() => void refresh()} />}
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="settings-search" className="sr-only">Search settings</label><input id="settings-search" type="search" placeholder="Search settings…" value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
      <nav aria-label="Settings groups" className="flex flex-wrap gap-2">{groups.map(group => <a key={group} href={`#${group.split(" ")[0].toLowerCase()}`} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100">{group}</a>)}</nav>
    </div>
    {query.isLoading ? <><Skeleton className="h-64" /><Skeleton className="h-64" /></> : <>
      {!settings.length && !query.error && <Card><p className="text-sm text-slate-500">No platform settings are available yet.</p></Card>}
      {settings.length > 0 && !settings.some(item => `${settingLabel(item.key)} ${item.description} ${item.key}`.toLowerCase().includes(search.toLowerCase())) && <p className="py-8 text-center text-sm text-slate-500">No settings match your search.</p>}
      {groups.map(group => {
        const rows = settings.filter(item => settingGroup(item.key) === group && `${settingLabel(item.key)} ${item.description} ${item.key}`.toLowerCase().includes(search.toLowerCase()));
        if (!rows.length) return null;
        return <section key={group} id={group.split(" ")[0].toLowerCase()} className="scroll-mt-24">
          <div className="mb-4 flex items-center gap-3"><h2 className="text-lg font-semibold text-slate-900">{group}</h2><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{rows.length}</span></div>
          <div className="grid items-stretch gap-4 xl:grid-cols-2">{rows.map(item => {
            const value = drafts[item.key] ?? item.value;
            const changed = !sameSettingValue(item, value, item.value);
            const error = settingError(item, value, values);
            const disabled = !!saving || uncertain || query.isFetching || !!query.error;
            const description = item.description.replace(/\s*Env default:.*$/i, "");
            const id = `setting-${item.key}`;
            return <form key={item.key} onSubmit={event => { event.preventDefault(); void save(item); }} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3"><label htmlFor={id} className="font-semibold text-slate-900">{settingLabel(item.key)}</label><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${changed ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{changed ? "Unsaved" : "Saved"}</span></div>
              <p id={`${id}-help`} className="mb-5 mt-2 text-sm leading-6 text-slate-500">{description}</p>
              <div className="mt-auto">
                <div className="flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  {item.type === "choice" ? <select id={id} value={value} disabled={disabled} aria-describedby={`${id}-help ${id}-error`} onChange={event => edit(item.key, event.target.value)} className="min-w-0 w-full bg-transparent px-4 py-3 text-sm capitalize outline-none">{!item.options?.includes(value) && <option value={value}>Choose an option</option>}{item.options?.map(option => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select> : <input id={id} type="number" inputMode={item.type === "integer" ? "numeric" : "decimal"} min={item.min ?? (item.type === "percent" ? 0 : undefined)} max={item.max ?? (item.type === "percent" ? 100 : undefined)} step={item.type === "integer" ? 1 : "any"} required value={value} disabled={disabled} aria-invalid={changed && !!error} aria-describedby={`${id}-help ${id}-error`} onChange={event => edit(item.key, event.target.value)} className="min-w-0 w-full bg-transparent px-4 py-3 text-base font-medium text-slate-900 outline-none disabled:bg-slate-50" />}
                  {item.unit && <span className="shrink-0 border-l border-slate-200 px-4 text-sm text-slate-500">{item.unit}</span>}
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500"><span>Current: {item.value}{item.unit ? ` ${item.unit}` : ""}</span>{item.default_value !== undefined && <span>Default: {item.default_value}{item.unit ? ` ${item.unit}` : ""}</span>}</div>
                <p id={`${id}-error`} role={changed && error ? "alert" : undefined} className="mt-2 min-h-4 text-xs text-rose-600">{changed ? error : ""}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={!changed || !!saving} onClick={() => setDrafts(previous => { const next = { ...previous }; delete next[item.key]; return next; })} className="text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40">Discard edit</button><Button type="submit" disabled={disabled || !changed || !!error}>{saving === item.key ? "Saving…" : "Save changes"}</Button></div>
                {feedback?.key === item.key && !feedback.error && <p role="status" className="mt-3 text-sm text-emerald-700">{feedback.text}</p>}
              </div>
            </form>;
          })}</div>
        </section>;
      })}
    </>}
  </div>;
}

export default function AdminPlatformSettingsPage() {
  const user = useAuthUser();
  if (!user?.id) return <p role="status" className="text-sm text-slate-500">Sign in as an admin to manage platform settings.</p>;
  return <SettingsEditor key={user.id + ":" + getAuth()?.access_token} adminId={user.id} />;
}
