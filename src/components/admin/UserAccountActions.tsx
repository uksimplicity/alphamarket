"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/dashboard/ui";
import { adminAccountQueryKeys, deleteAdminUser, setAdminUserStatus } from "./users";

export default function UserAccountActions({ id, email, status }: { id: string; email: string; status: string }) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const normalizedStatus = status.trim().toLowerCase();

  async function run(action: () => Promise<unknown>) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await action();
      setConfirmDelete(false);
      await Promise.all(adminAccountQueryKeys.map((key) => client.invalidateQueries({ queryKey: [key] })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The account could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap justify-start gap-2 md:justify-end">
        <Button variant="ghost" disabled={pending || !id || normalizedStatus === "suspended"}
          onClick={() => run(() => setAdminUserStatus(id, "suspended"))}>
          {normalizedStatus === "suspended" ? "Suspended" : "Suspend"}
        </Button>
        <Button variant={normalizedStatus === "active" ? "ghost" : "primary"}
          disabled={pending || !id || normalizedStatus === "active"}
          onClick={() => run(() => setAdminUserStatus(id, "active"))}>
          {normalizedStatus === "active" ? "Active" : normalizedStatus === "suspended" ? "Reactivate" : "Approve"}
        </Button>
        <Button variant="ghost" disabled={pending || !email} onClick={() => { setError(""); setConfirmDelete(true); }}>
          Delete
        </Button>
      </div>
      {confirmDelete ? (
        <div role="alertdialog" aria-label="Confirm account deletion" aria-describedby={`delete-account-${id}`}
          className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <p id={`delete-account-${id}`}>Delete the account for {email}? This cannot be undone.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="ghost" disabled={pending} onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button disabled={pending} onClick={() => run(() => deleteAdminUser(email))}>Confirm delete</Button>
          </div>
        </div>
      ) : null}
      {pending ? <p role="status" className="mt-2 text-xs text-slate-500">Updating account...</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
