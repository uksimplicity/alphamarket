"use client";
import { useRef, useState, type FormEvent } from "react";
import { getAuth } from "@/components/auth/authStorage";
import { accountStamp, checkAccount } from "@/components/commerce/localAccountData";
import { uploadProductMedia } from "@/components/vendor/sellerProductForm";
import { useAdsDirectory, useAdsMutation } from "./hooks";
import { hierarchyLabel, numeric, record, text, userUpdate, type AdRecord } from "./data";
import { Feedback } from "./Common";
import styles from "./ads.module.css";

export default function AdEditor({ item, admin, onSaved, onCancel }: { item: AdRecord; admin: boolean; onSaved: () => void; onCancel: () => void }) {
  const original = userUpdate(item);
  const [form, setForm] = useState({ name: original.name, description: original.shortDescription, price: text(original.basePrice), category: original.categoryId, location: original.locationId, address: original.address, stock: original.stock === null ? "" : text(original.stock), reason: "" });
  const originalMedia = record(item.media);
  const [cover, setCover] = useState(text(originalMedia.cover));
  const [images, setImages] = useState<string[]>(Array.isArray(originalMedia.images) ? originalMedia.images.filter((value): value is string => typeof value === "string") : []);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const cache = useRef(new WeakMap<File, { stamp: string; url: string }>());
  const lock = useRef(false);
  const categories = useAdsDirectory("/api/ads/categories"), locations = useAdsDirectory("/api/ads/locations");
  const mutation = useAdsMutation();
  const disabled = uploading || mutation.disabled;
  const change = (key: keyof typeof form, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (lock.current || disabled) return;
    setError("");
    const price = numeric(form.price), stock = form.stock.trim() ? numeric(form.stock) : null;
    if (!form.name.trim() || form.name.trim().length > 200 || price === null || price <= 0 || price > 1e9 || !form.category || !form.location) { setError("Enter a title, a valid price, category and supported location."); return; }
    if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 1e6)) { setError("Stock must be a whole number between 0 and 1,000,000."); return; }
    if ([coverFile, ...files].some(file => file && file.size > 3 * 1024 * 1024)) { setError("Each photo must be at most 3 MB."); return; }
    const candidate: AdRecord = { name: form.name.trim(), shortDescription: form.description.trim(), basePrice: price, categoryId: form.category, locationId: form.location, ...(!admin ? { address: form.address.trim() } : {}), ...(stock !== null ? { stock } : {}) };
    const body: AdRecord = {};
    const fields: Record<string, string> = admin ? { name: "name", shortDescription: "description", basePrice: "base_price", categoryId: "category_id", locationId: "location_id", stock: "stock" } : {};
    for (const [key, value] of Object.entries(candidate)) if (value !== original[key as keyof typeof original]) body[fields[key] || key] = value;
    lock.current = true; setUploading(true);
    try {
      const stamp = accountStamp(), token = getAuth()?.access_token;
      if (!token) throw new Error("Sign in to save this ad.");
      async function upload(file: File) {
        const existing = cache.current.get(file);
        if (existing?.stamp === stamp) return existing.url;
        const url = await uploadProductMedia(file, token!);
        checkAccount(stamp); cache.current.set(file, { stamp, url }); return url;
      }
      const gallery = await Promise.allSettled(files.map(upload));
      const failed = gallery.find(value => value.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
      const uploadedCover = coverFile ? await upload(coverFile) : cover;
      const mediaChanged = coverFile || files.length || cover !== text(originalMedia.cover) || JSON.stringify(images) !== JSON.stringify(originalMedia.images || []);
      if (mediaChanged) body.media = { ...originalMedia, cover: uploadedCover, images: [...images, ...gallery.flatMap(value => value.status === "fulfilled" ? [value.value] : [])] };
      if (!Object.keys(body).length) { setError("Make a change before saving."); return; }
      if (admin && form.reason.trim()) body.reason = form.reason.trim();
      checkAccount(stamp);
      if (await mutation.run(`${admin ? "/api/admin/ads" : "/api/my-ads"}/${encodeURIComponent(text(item.id))}`, "PUT", body)) onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save this ad."); }
    finally { lock.current = false; setUploading(false); }
  }
  return <section className={styles.card}><h2>Edit ad</h2><p className={styles.muted}>{admin ? "Your edit is logged and preserves the moderation status." : "Changing an approved ad’s title, description, media or category sends it back for review. Saving requested changes resubmits the ad."}</p><form className={styles.form} onSubmit={save}>
    <label>Title<input value={form.name} maxLength={200} disabled={disabled} onChange={event => change("name", event.target.value)} required /></label>
    <label>Price (NGN)<input type="number" min="0.01" max="1000000000" step="0.01" value={form.price} disabled={disabled} onChange={event => change("price", event.target.value)} required /></label>
    <label>Category<select value={form.category} disabled={disabled} onChange={event => change("category", event.target.value)} required><option value="">Select category</option>{form.category && !categories.data?.some(row => row.id === form.category) ? <option value={form.category}>{text(record(item.category).name, "Current category")}</option> : null}{categories.data?.map(row => <option key={text(row.id)} value={text(row.id)}>{text(row.name)}</option>)}</select></label>
    <label>Supported location<select value={form.location} disabled={disabled} onChange={event => change("location", event.target.value)} required><option value="">Select location</option>{form.location && !locations.data?.some(row => row.id === form.location) ? <option value={form.location}>{text(record(item.location).name, "Current location")}</option> : null}{locations.data?.map(row => <option key={text(row.id)} value={text(row.id)}>{hierarchyLabel(row, locations.data || [])}</option>)}</select></label>
    <label className={styles.wide}>Description<textarea value={form.description} rows={4} disabled={disabled} onChange={event => change("description", event.target.value)} /></label>
    {!admin ? <label className={styles.wide}>Full address<input value={form.address} disabled={disabled} onChange={event => change("address", event.target.value)} /></label> : null}
    <label>Stock<input type="number" min={0} max={1000000} value={form.stock} disabled={disabled} onChange={event => change("stock", event.target.value)} /></label>
    {admin ? <label>Reason for edit (optional)<input value={form.reason} maxLength={2000} disabled={disabled} onChange={event => change("reason", event.target.value)} /></label> : null}
    <div className={styles.wide}><h3>Photos</h3><p className={styles.muted}>Each new photo can be up to 3 MB. Existing video is preserved.</p>{cover ? <div className={styles.actions}><span>Current cover photo</span><button type="button" disabled={disabled} onClick={() => { setCover(""); setCoverFile(null); }}>Remove cover</button></div> : null}<label>Replace cover<input type="file" accept="image/*" disabled={disabled} onChange={event => setCoverFile(event.target.files?.[0] || null)} /></label><div className={styles.actions}>{images.map((image, index) => <button type="button" key={`${image}-${index}`} disabled={disabled} onClick={() => setImages(previous => previous.filter((_, position) => position !== index))}>Remove photo {index + 1}</button>)}</div><label>Add gallery photos<input type="file" accept="image/*" multiple disabled={disabled} onChange={event => { setFiles(previous => [...previous, ...Array.from(event.target.files || [])]); event.target.value = ""; }} /></label><div className={styles.actions}>{files.map((file, index) => <button type="button" key={index} disabled={disabled} onClick={() => setFiles(previous => previous.filter((_, position) => position !== index))}>Remove {file.name}</button>)}</div></div>
    <div className={styles.wide}><Feedback error={error || mutation.error || categories.error || locations.error} uncertain={mutation.uncertain} /><div className={styles.actions}><button className={styles.primary} type="submit" disabled={disabled}>{disabled ? "Saving…" : "Save changes"}</button><button type="button" disabled={uploading || mutation.busy} onClick={onCancel}>Cancel</button></div></div>
  </form></section>;
}
