"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/dashboard/ui";

export default function AccountDeleteConfirmation({ email, pending, onConfirm, onCancel }: {
  email: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const descriptionId = useId();
  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog ref={dialog} role="alertdialog" aria-label="Confirm account deletion" aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
      className="fixed inset-0 m-auto w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-800 shadow-xl backdrop:bg-slate-900/40">
      <p id={descriptionId} className="text-base font-semibold">Are you sure you want to delete this account?</p>
      <p className="mt-2 break-all text-slate-500">{email}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" autoFocus disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button variant="danger" disabled={pending || !email.trim()} onClick={onConfirm}>Yes</Button>
      </div>
    </dialog>
  );
}
