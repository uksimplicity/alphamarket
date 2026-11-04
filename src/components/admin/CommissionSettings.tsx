"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuth } from "@/components/auth/authStorage";
import { useAuthUser } from "@/components/auth/useAuthUser";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { Button, Card, ErrorState, SectionTitle } from "@/components/dashboard/ui";

type Setting = { percentage: number | null };
async function request(method: "GET" | "PUT", signal: AbortSignal, percentage?: number) {
  const stamp = accountStamp(), auth = getAuth();
  if (!auth?.user.id) throw new Error("Please sign in as an admin.");
  const path = "/api/admin/commission-setting" + (method === "PUT" ? "?admin_id=" + encodeURIComponent(auth.user.id) : "");
  const response = await fetch(path, { method, cache: "no-store", redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]),
    headers: { Authorization: "Bearer " + auth.access_token.replace(/^Bearer\s+/i, "").trim(), Accept: "application/json", ...(method === "PUT" ? { "Content-Type": "application/json" } : {}) },
    ...(method === "PUT" ? { body: JSON.stringify({ percentage }) } : {}) });
  const payload = await response.json();
  checkAccount(stamp);
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || "Commission settings could not be saved.");
  return payload;
}

function PercentageForm({ adminId }: { adminId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null), [saving, setSaving] = useState(false), [message, setMessage] = useState(""), [uncertain, setUncertain] = useState(false);
  const lock = useRef(false), lifetime = useRef<AbortController | null>(null);
  useEffect(() => { const controller = new AbortController(); lifetime.current = controller; return () => controller.abort(); }, []);
  const queryKey = ["admin-commission-setting", adminId];
  const { data, isLoading, error, refetch } = useQuery<Setting>({ queryKey, retry: false, queryFn: async ({ signal }) => {
    const payload = await request("GET", signal);
    if (payload.percentage !== null && (typeof payload.percentage !== "number" || !Number.isFinite(payload.percentage) || payload.percentage < 0 || payload.percentage > 100)) throw new Error("The saved percentage could not be read.");
    return { percentage: payload.percentage };
  } });
  const value = draft ?? (data?.percentage == null ? "" : String(data.percentage));
  const valid = value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;
  async function refresh() {
    const result = await refetch();
    if (!result.isError && !lifetime.current?.signal.aborted) { setUncertain(false); setMessage(""); }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current || uncertain || !valid || !data || Number(value) === data.percentage) return;
    lock.current = true; setSaving(true); setMessage("");
    const controller = lifetime.current;
    try {
      await request("PUT", controller!.signal, Number(value));
      if (controller?.signal.aborted) return;
      // Read back the authoritative setting before reporting a confirmed saved value.
      const saved = await refetch();
      if (controller?.signal.aborted) return;
      if (saved.isError || saved.data?.percentage !== Number(value)) throw new Error("The saved value could not be verified. Refresh the saved percentage before trying again.");
      setDraft(null); setMessage("Commission percentage saved.");
      void queryClient.invalidateQueries({ queryKey: ["admin-platform-settings"] });
    } catch (failure) { if (!controller?.signal.aborted) { setMessage(failure instanceof Error ? failure.message : "The save result could not be confirmed."); setUncertain(true); } }
    finally { lock.current = false; if (!controller?.signal.aborted) setSaving(false); }
  }
  return <Card>
    <SectionTitle title="Commission percentage" subtitle="Enter the percentage you want to save. No rate is selected by default." />
    {isLoading ? <p role="status" className="mt-4 text-sm text-slate-500">Loading saved percentage...</p> : error ? <div className="mt-4"><ErrorState message={error.message} onRetry={() => void refresh()} /></div> : <>
      <p className="mt-4 text-sm text-slate-600">Saved percentage: <strong>{data?.percentage == null ? "Not set" : data.percentage + "%"}</strong></p>
      <form onSubmit={save} className="mt-4 grid max-w-lg gap-3">
        <label htmlFor="commission-percentage" className="text-sm font-medium text-slate-700">Percentage (%)</label>
        <input id="commission-percentage" type="number" min="0" max="100" step="any" required inputMode="decimal" value={value} disabled={saving} onChange={event => { setDraft(event.target.value); setMessage(""); }} aria-describedby="commission-percentage-help" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <p id="commission-percentage-help" className="text-xs text-slate-500">Enter 10 for 10%. You can choose any percentage from 0 to 100.</p>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving || uncertain || !valid || !data || Number(value) === data.percentage}>{saving ? "Saving..." : "Save percentage"}</Button><Button variant="ghost" disabled={saving} onClick={() => void refresh()}>Refresh saved percentage</Button></div>
      </form>
    </>}
    {message ? <p role={uncertain ? "alert" : "status"} className="mt-3 text-sm text-slate-700">{message}</p> : null}
  </Card>;
}

export default function CommissionSettings() {
  const user = useAuthUser();
  if (!user?.id) return null;
  return <PercentageForm key={user.id + ":" + getAuth()?.access_token} adminId={user.id} />;
}
