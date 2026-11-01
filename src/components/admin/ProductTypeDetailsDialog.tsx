"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/dashboard/ui";
import type { CatalogItem } from "./catalogRecords";

export default function ProductTypeDetailsDialog({ item, loading, error, onClose }: {
  item: CatalogItem; loading: boolean; error: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-auto w-[min(480px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl backdrop:bg-slate-900/40">
      <h2 id={titleId} className="text-lg font-semibold">Product type details</h2>
      <dl className="mt-5 grid gap-4 text-sm [overflow-wrap:anywhere]">
        <div><dt className="text-slate-500">Product type</dt><dd className="mt-1 font-semibold">{item.name}</dd></div>
        <div><dt className="text-slate-500">Category</dt><dd className="mt-1 font-semibold">{loading ? "Loading category..." : item.categoryName || "Category unavailable"}</dd></div>
      </dl>
      {error ? <p role="alert" className="mt-4 text-sm text-red-700">{error}</p> : null}
      <div className="mt-6 flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
    </dialog>
  );
}
