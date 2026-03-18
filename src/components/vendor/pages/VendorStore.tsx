"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAuth } from "@/components/auth/authStorage";
import {
  fetchCurrentUserProfile,
  uploadProfilePicture,
} from "@/components/auth/profileClient";
import {
  getCurrentSellerStoreProfile,
  saveCurrentSellerStoreProfile,
  type SellerStoreProfile,
} from "@/components/store/storeProfileClient";
import styles from "@/components/vendor/vendor.module.css";

export default function VendorStore() {
  const [store, setStore] = useState<SellerStoreProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    storeName: "",
    description: "",
    location: "",
    logoUrl: "",
    logoFallbackDataUrl: "",
  });
  const [failedLogoSrc, setFailedLogoSrc] = useState("");

  const hasStore = Boolean(store);
  const actionLabel = hasStore ? "Update Store" : "Create Store";

  const loadStore = async () => {
    setLoading(true);
    setError("");
    try {
      const cached = getCurrentSellerStoreProfile();
      if (cached) {
        setStore(cached);
        setForm({
          storeName: cached.name,
          description: cached.description,
          location: cached.location,
          logoUrl: cached.logoUrl,
          logoFallbackDataUrl: cached.logoFallbackDataUrl,
        });
        return;
      }

      const profile = await fetchCurrentUserProfile();
      const inferredName =
        profile.name && profile.name !== "My Account" ? `${profile.name} Store` : "";
      const inferredLocation = [profile.city, profile.state, profile.country]
        .filter(Boolean)
        .join(", ");
      setForm({
        storeName: inferredName,
        description: "",
        location: inferredLocation,
        logoUrl: profile.profilePicture,
        logoFallbackDataUrl: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load store setup.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStore();
  }, []);

  const previewLogo = useMemo(() => {
    if (logoFile) {
      return URL.createObjectURL(logoFile);
    }
    return form.logoFallbackDataUrl || form.logoUrl;
  }, [form.logoFallbackDataUrl, form.logoUrl, logoFile]);

  useEffect(() => {
    return () => {
      if (logoFile && previewLogo.startsWith("blob:")) {
        URL.revokeObjectURL(previewLogo);
      }
    };
  }, [logoFile, previewLogo]);

  const handleSave = async () => {
    setError("");
    setSuccess("");
    const name = form.storeName.trim();
    if (!name) {
      setError("Store name is required.");
      return;
    }

    const auth = getAuth();
    if (!auth?.access_token) {
      setError("You must be logged in to manage your store.");
      return;
    }

    setSaving(true);
    try {
      let logoUrl = form.logoUrl;
      let logoFallbackDataUrl = form.logoFallbackDataUrl;
      if (logoFile) {
        logoUrl = await uploadProfilePicture(logoFile);
        try {
          logoFallbackDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Failed to read selected logo file."));
            reader.onload = () =>
              resolve(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(logoFile);
          });
        } catch {
          logoFallbackDataUrl = "";
        }
      }

      const saved = saveCurrentSellerStoreProfile({
        name,
        description: form.description.trim(),
        location: form.location.trim(),
        logoUrl,
        logoFallbackDataUrl,
      });
      setStore(saved);
      setForm({
        storeName: saved.name,
        description: saved.description,
        location: saved.location,
        logoUrl: saved.logoUrl,
        logoFallbackDataUrl: saved.logoFallbackDataUrl,
      });
      setLogoFile(null);
      setFailedLogoSrc("");
      setSuccess(hasStore ? "Store updated successfully." : "Store created successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save store.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className={styles.card}>
        <div className={styles.cardSubtitle}>Loading store setup...</div>
      </section>
    );
  }

  return (
    <section className={`${styles.card} grid gap-4`}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitle}>My Store</div>
          <div className={styles.cardSubtitle}>
            Create and manage your storefront details as buyers will see them.
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className={styles.settingsLabel}>Store Name</span>
          <input
            className="h-10 rounded-lg border border-slate-300 px-3 outline-none focus:border-brand"
            value={form.storeName}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, storeName: event.target.value }))
            }
            placeholder="e.g. Moses Electronics"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className={styles.settingsLabel}>Store Location</span>
          <input
            className="h-10 rounded-lg border border-slate-300 px-3 outline-none focus:border-brand"
            value={form.location}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, location: event.target.value }))
            }
            placeholder="City, State, Country"
          />
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className={styles.settingsLabel}>Store Description</span>
        <textarea
          className="min-h-28 rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-brand"
          value={form.description}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, description: event.target.value }))
          }
          placeholder="Describe what your store sells and what makes it special."
        />
      </label>

      <div className="grid gap-2">
        <span className={styles.settingsLabel}>Store Logo</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100">
            {previewLogo && failedLogoSrc !== previewLogo ? (
              <img
                src={previewLogo}
                alt="Store logo preview"
                className="h-full w-full object-cover"
                onError={() => setFailedLogoSrc(previewLogo)}
              />
                ) : (
              <span className="text-xs font-semibold text-slate-500">Logo</span>
            )}
          </span>
          <input
            type="file"
            accept="image/*"
            className="text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700"
            onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
          />
        </div>
        {failedLogoSrc ? (
          <div className="text-xs text-amber-700">
            Logo preview source failed. A local fallback will be used after save.
          </div>
        ) : null}
      </div>

      {error ? <div className="text-sm text-rose-600">{error}</div> : null}
      {success ? <div className="text-sm text-emerald-600">{success}</div> : null}

      {store ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">Store URL</div>
          <div>{`/store/${store.slug}`}</div>
        </div>
      ) : null}

      <div className={styles.settingsActions}>
        {store ? (
          <Link to={`/store/${store.slug}`} className={styles.settingsSecondary}>
            View Store Page
          </Link>
        ) : null}
        <button
          type="button"
          className={styles.settingsPrimary}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : actionLabel}
        </button>
        <Link to="/vendor/products/create" className={styles.settingsSecondary}>
          Add Product
        </Link>
      </div>
    </section>
  );
}
