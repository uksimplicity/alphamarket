"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminFetcher, asArray, asRecord, pickString } from "@/components/admin/api";
import { Button, Card, ErrorState, SectionTitle, Skeleton } from "@/components/dashboard/ui";

function pretty(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AdminPlatformSettingsPage() {
  const [keyInput, setKeyInput] = useState("");
  const [adminId, setAdminId] = useState("");
  const [upsertPayload, setUpsertPayload] = useState({ key: "", value: "", description: "" });
  const [lookupResult, setLookupResult] = useState("");
  const [message, setMessage] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-platform-settings"],
    queryFn: async () => {
      const payload = await adminFetcher<unknown>("/platform-settings/all");
      return asArray(payload).map((row, index) => {
        const record = asRecord(row);
        return {
          key: pickString(record, ["key"], `setting-${index}`),
          value: pickString(record, ["value"], ""),
          description: pickString(record, ["description"], ""),
        };
      });
    },
  });

  async function getByKey() {
    if (!keyInput.trim()) {
      setMessage("Enter setting key.");
      return;
    }

    try {
      setMessage("");
      const payload = await adminFetcher<unknown>(`/platform-settings/${keyInput.trim()}`);
      setLookupResult(pretty(payload));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to fetch setting.");
    }
  }

  async function upsertSetting() {
    if (!adminId.trim() || !upsertPayload.key.trim()) {
      setMessage("Admin ID and key are required.");
      return;
    }

    try {
      setMessage("");
      await adminFetcher(`/platform-settings/upsert?admin_id=${encodeURIComponent(adminId.trim())}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: upsertPayload.key.trim(),
          value: upsertPayload.value,
          description: upsertPayload.description,
        }),
      });
      setMessage("Platform setting saved.");
      await refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to save setting.");
    }
  }

  async function deleteByKey() {
    if (!keyInput.trim()) {
      setMessage("Enter setting key.");
      return;
    }

    if (!window.confirm(`Delete platform setting '${keyInput.trim()}'?`)) return;

    try {
      setMessage("");
      await adminFetcher(`/platform-settings/${keyInput.trim()}`, { method: "DELETE" });
      setMessage("Platform setting deleted.");
      setLookupResult("");
      await refetch();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to delete setting.");
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : "Failed to load platform settings."}
        onRetry={refetch}
      />
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <SectionTitle title="Platform Settings" subtitle="Read and manage application-wide config keys." />
        <div className="mt-4 space-y-3 text-sm">
          {data?.map((item) => (
            <div key={item.key} className="rounded-xl border border-slate-200 p-3">
              <div className="font-semibold text-slate-800">{item.key}</div>
              <div className="mt-1 text-slate-600">{item.value || "-"}</div>
              <div className="mt-1 text-xs text-slate-500">{item.description || "No description"}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Get or Delete by Key" subtitle="Use one setting key to inspect or remove." />
        <div className="mt-3 flex gap-2">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="setting key" value={keyInput} onChange={(event) => setKeyInput(event.target.value)} />
          <Button variant="ghost" onClick={getByKey}>Get</Button>
          <Button onClick={deleteByKey}>Delete</Button>
        </div>
        <pre className="mt-3 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{lookupResult || "Setting payload will appear here."}</pre>
      </Card>

      <Card>
        <SectionTitle title="Upsert Setting" subtitle="Create new or update existing setting key." />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="admin_id" value={adminId} onChange={(event) => setAdminId(event.target.value)} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="key" value={upsertPayload.key} onChange={(event) => setUpsertPayload((prev) => ({ ...prev, key: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="value" value={upsertPayload.value} onChange={(event) => setUpsertPayload((prev) => ({ ...prev, value: event.target.value }))} />
          <input className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="description" value={upsertPayload.description} onChange={(event) => setUpsertPayload((prev) => ({ ...prev, description: event.target.value }))} />
        </div>
        <div className="mt-3">
          <Button onClick={upsertSetting}>Save Setting</Button>
        </div>

        {message ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{message}</div>
        ) : null}
      </Card>
    </div>
  );
}
