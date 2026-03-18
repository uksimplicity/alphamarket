"use client";

import { getAuth } from "@/components/auth/authStorage";

const STORE_PROFILES_KEY = "alpha.vendor.storeProfiles.v1";
const STORE_PROFILES_EVENT = "alpha-vendor-store-updated";
let cachedRawStoreProfiles = "";
let cachedParsedStoreProfiles: SellerStoreProfile[] = [];

export type SellerStoreProfile = {
  ownerKey: string;
  slug: string;
  name: string;
  description: string;
  location: string;
  logoUrl: string;
  logoFallbackDataUrl: string;
  createdAt: string;
  updatedAt: string;
};

type StoreProfileInput = {
  name: string;
  description?: string;
  location?: string;
  logoUrl?: string;
  logoFallbackDataUrl?: string;
};

function isBrowser() {
  return typeof window !== "undefined";
}

export function slugifyStoreName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function getOwnerKey() {
  const auth = getAuth();
  return String(auth?.user?.id ?? auth?.user?.email ?? "").trim();
}

function parseStoreProfile(raw: unknown): SellerStoreProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const ownerKey = String(record.ownerKey ?? "").trim();
  const slug = String(record.slug ?? "").trim();
  const name = String(record.name ?? "").trim();
  if (!ownerKey || !slug || !name) return null;

  return {
    ownerKey,
    slug,
    name,
    description: String(record.description ?? ""),
    location: String(record.location ?? ""),
    logoUrl: String(record.logoUrl ?? ""),
    logoFallbackDataUrl: String(record.logoFallbackDataUrl ?? ""),
    createdAt: String(record.createdAt ?? new Date().toISOString()),
    updatedAt: String(record.updatedAt ?? new Date().toISOString()),
  };
}

function readAllStoreProfiles(): SellerStoreProfile[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORE_PROFILES_KEY);
    if (!raw) return [];
    if (raw === cachedRawStoreProfiles) {
      return cachedParsedStoreProfiles;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((entry) => parseStoreProfile(entry))
      .filter((entry): entry is SellerStoreProfile => Boolean(entry));
    cachedRawStoreProfiles = raw;
    cachedParsedStoreProfiles = normalized;
    return normalized;
  } catch {
    return [];
  }
}

function writeAllStoreProfiles(profiles: SellerStoreProfile[]) {
  if (!isBrowser()) return;
  try {
    const serialized = JSON.stringify(profiles);
    cachedRawStoreProfiles = serialized;
    cachedParsedStoreProfiles = profiles;
    window.localStorage.setItem(STORE_PROFILES_KEY, serialized);
    window.dispatchEvent(new Event(STORE_PROFILES_EVENT));
  } catch {
    // ignore storage write issues
  }
}

export function subscribeStoreProfiles(onChange: () => void) {
  if (!isBrowser()) return () => {};
  window.addEventListener(STORE_PROFILES_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(STORE_PROFILES_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getCurrentSellerStoreProfile(): SellerStoreProfile | null {
  const ownerKey = getOwnerKey();
  if (!ownerKey) return null;
  const profiles = readAllStoreProfiles();
  return profiles.find((entry) => entry.ownerKey === ownerKey) ?? null;
}

export function getStoreProfileBySlug(slug: string): SellerStoreProfile | null {
  const normalizedSlug = slugifyStoreName(slug);
  if (!normalizedSlug) return null;
  const profiles = readAllStoreProfiles();
  return profiles.find((entry) => entry.slug === normalizedSlug) ?? null;
}

export function saveCurrentSellerStoreProfile(
  input: StoreProfileInput
): SellerStoreProfile {
  const ownerKey = getOwnerKey();
  if (!ownerKey) {
    throw new Error("You must be logged in to create or update your store.");
  }

  const profiles = readAllStoreProfiles();
  const current = profiles.find((entry) => entry.ownerKey === ownerKey) ?? null;
  const nextName = input.name.trim() || current?.name || "";
  if (!nextName) {
    throw new Error("Store name is required.");
  }

  const now = new Date().toISOString();
  const next: SellerStoreProfile = {
    ownerKey,
    slug: current?.slug || slugifyStoreName(nextName),
    name: nextName,
    description: String(input.description ?? current?.description ?? ""),
    location: String(input.location ?? current?.location ?? ""),
    logoUrl: String(input.logoUrl ?? current?.logoUrl ?? ""),
    logoFallbackDataUrl: String(
      input.logoFallbackDataUrl ?? current?.logoFallbackDataUrl ?? ""
    ),
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };

  const nextProfiles = [next, ...profiles.filter((entry) => entry.ownerKey !== ownerKey)];
  writeAllStoreProfiles(nextProfiles);
  return next;
}
