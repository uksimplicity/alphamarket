"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/dashboard/ui";
import { loadProductTypeDetails, type CatalogItem } from "./catalogRecords";

export default function ProductTypeEditDialog({ item, categories, onSave, onClose }: {
  item: CatalogItem; categories: CatalogItem[];
  onSave: (name: string, categoryId: string) => Promise<void>; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const nameId = useId();
  const categoryId = useId();
  const [name, setName] = useState(item.name);
  const [selectedCategory, setSelectedCategory] = useState(item.categoryId || "");
  const categoryChanged = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    loadProductTypeDetails(item, categories).then((details) => {
      if (active && !categoryChanged.current) {
        setSelectedCategory(details.categoryId || categories.find((category) => category.name === details.categoryName)?.id || "");
      }
    }).catch(() => { /* Keep the existing mapping unless the admin selects a replacement. */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item, categories]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    if (!name.trim()) { setError("Product type name is required."); return; }
    savingRef.current = true;
    setSaving(true);
    setError("");
    try { await onSave(name.trim(), selectedCategory); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to update product type."); }
    finally { savingRef.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!savingRef.current) onClose(); }}
    className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[min(480px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 shadow-xl backdrop:bg-slate-900/40">
    <h2 id={titleId} className="text-lg font-semibold">Edit product type</h2>
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <div className="grid gap-2"><label htmlFor={nameId} className="text-sm font-medium">Product type name *</label>
        <input id={nameId} autoFocus aria-required="true" value={name} onChange={(event) => setName(event.target.value)} disabled={saving}
          className="w-full rounded-lg border border-slate-200 px-3 py-2" /></div>
      <div className="grid gap-2"><label htmlFor={categoryId} className="text-sm font-medium">Category</label>
        <select id={categoryId} value={selectedCategory} disabled={saving || loading}
          onChange={(event) => { categoryChanged.current = true; setSelectedCategory(event.target.value); }}
          className="w-full rounded-lg border border-slate-200 px-3 py-2">
          <option value="" disabled>{loading ? "Loading category..." : item.categoryName || "Keep current category"}</option>
          {selectedCategory && !categories.some((category) => category.id === selectedCategory)
            ? <option value={selectedCategory}>{item.categoryName || "Current category"}</option> : null}
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select></div>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={saving || loading}>{saving ? "Saving..." : "Save changes"}</Button>
      </div>
    </form>
  </dialog>;
}
