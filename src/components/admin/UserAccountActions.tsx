"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/dashboard/ui";
import { adminAccountQueryKeys, deleteAdminUser, setAdminUserStatus } from "./users";
import { useAdminToast } from "./AdminToastProvider";
import AccountDeleteConfirmation from "./AccountDeleteConfirmation";

export default function UserAccountActions({ id, email, status }: { id: string; email: string; status: string }) {
  const client = useQueryClient();
  const showToast = useAdminToast();
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const normalizedStatus = status.trim().toLowerCase();

  async function run(action: () => Promise<unknown>, successMessage: string) {
    if (pending) return;
    setPending(true);
    try {
      await action();
      showToast(successMessage);
      setConfirmDelete(false);
      await Promise.all(adminAccountQueryKeys.map((key) => client.invalidateQueries({ queryKey: [key] })));
    } catch (err) {
      setConfirmDelete(false);
      showToast(err instanceof Error ? err.message : "The account could not be updated.", "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap justify-start gap-2 md:justify-end">
        <Button variant="warning" disabled={pending || !id || normalizedStatus === "suspended"}
          onClick={() => run(() => setAdminUserStatus(id, "suspended"), "Account suspended successfully.")}>
          {normalizedStatus === "suspended" ? "Suspended" : "Suspend"}
        </Button>
        <Button variant="success"
          disabled={pending || !id || normalizedStatus === "active"}
          onClick={() => run(() => setAdminUserStatus(id, "active"), normalizedStatus === "suspended" ? "Account reactivated successfully." : "Account approved successfully.")}>
          {normalizedStatus === "active" ? "Active" : normalizedStatus === "suspended" ? "Reactivate" : "Approve"}
        </Button>
        <Button variant="danger" disabled={pending || !email} onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>
      {confirmDelete ? (
        <AccountDeleteConfirmation email={email} pending={pending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => run(() => deleteAdminUser(email), "Account deleted successfully.")} />
      ) : null}
      {pending ? <p role="status" className="mt-2 text-xs text-slate-500">Updating account...</p> : null}
    </div>
  );
}
