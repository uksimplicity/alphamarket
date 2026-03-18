"use client";

import { getAuth, getDisplayName } from "@/components/auth/authStorage";

type AnyRecord = Record<string, unknown>;

function pickRecord(payload: unknown): AnyRecord {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as AnyRecord;
  const candidate = (root.data ?? root.user ?? root.profile ?? root) as unknown;
  return candidate && typeof candidate === "object" ? (candidate as AnyRecord) : {};
}

function toText(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function resolveAssetUrl(input: string) {
  const value = input.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("//")) return `https:${value}`;

  const rawBase = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
  if (!rawBase) return value;

  try {
    const baseUrl = new URL(rawBase);
    const origin = baseUrl.origin;
    if (value.startsWith("/")) return `${origin}${value}`;
    return `${origin}/${value.replace(/^\/+/, "")}`;
  } catch {
    return value;
  }
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "verified"].includes(normalized)) return true;
    if (["false", "0", "no", "unverified"].includes(normalized)) return false;
  }
  return fallback;
}

export type CurrentUserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  phoneVerified: boolean;
  role: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  profilePicture: string;
};

export type UpdateProfileInput = {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  profilePicture?: string;
};

const PROFILE_ADDRESS_CACHE_KEY = "alpha.profile.address";
const PROFILE_PICTURE_CACHE_KEY = "alpha.profile.picture";

type CachedAddressEntry = UpdateProfileInput & {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  userKey: string;
};

type CachedPictureEntry = {
  userKey: string;
  profilePicture: string;
  fallbackDataUrl?: string;
};

function getUserCacheKey() {
  const auth = getAuth();
  return auth?.user?.id || auth?.user?.email || "";
}

function readCachedAddress(userKey: string): UpdateProfileInput | null {
  if (typeof window === "undefined" || !userKey) return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_ADDRESS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAddressEntry;
    if (!parsed || parsed.userKey !== userKey) return null;
    return {
      address: toText(parsed.address),
      city: toText(parsed.city),
      state: toText(parsed.state),
      country: toText(parsed.country),
      postalCode: toText(parsed.postalCode),
    };
  } catch {
    return null;
  }
}

function writeCachedAddress(userKey: string, input: UpdateProfileInput) {
  if (typeof window === "undefined" || !userKey) return;
  try {
    const payload: CachedAddressEntry = {
      userKey,
      address: input.address,
      city: input.city,
      state: input.state,
      country: input.country,
      postalCode: input.postalCode,
    };
    window.localStorage.setItem(PROFILE_ADDRESS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore cache write errors
  }
}

function readCachedProfilePicture(userKey: string): {
  profilePicture: string;
  fallbackDataUrl: string;
} {
  if (typeof window === "undefined" || !userKey) {
    return { profilePicture: "", fallbackDataUrl: "" };
  }
  try {
    const raw = window.localStorage.getItem(PROFILE_PICTURE_CACHE_KEY);
    if (!raw) return { profilePicture: "", fallbackDataUrl: "" };
    const parsed = JSON.parse(raw) as CachedPictureEntry;
    if (!parsed || parsed.userKey !== userKey) {
      return { profilePicture: "", fallbackDataUrl: "" };
    }
    return {
      profilePicture: toText(parsed.profilePicture),
      fallbackDataUrl: toText(parsed.fallbackDataUrl),
    };
  } catch {
    return { profilePicture: "", fallbackDataUrl: "" };
  }
}

function writeCachedProfilePicture(
  userKey: string,
  profilePicture: string,
  fallbackDataUrl = ""
) {
  if (typeof window === "undefined" || !userKey) return;
  try {
    const payload: CachedPictureEntry = {
      userKey,
      profilePicture,
      fallbackDataUrl,
    };
    window.localStorage.setItem(PROFILE_PICTURE_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore cache write errors
  }
}

export async function fetchCurrentUserProfile(): Promise<CurrentUserProfile> {
  const auth = getAuth();
  const token = auth?.access_token;
  const userKey = getUserCacheKey();

  const response = await fetch("/api/user/profile", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Failed to load profile (${response.status}).`;
    throw new Error(message);
  }

  const record = pickRecord(payload);
  const firstName = toText(record.first_name, auth?.user?.first_name ?? "");
  const lastName = toText(record.last_name, auth?.user?.last_name ?? "");
  const backendFullName = toText(
    record.full_name,
    toText(record.name, toText(record.fullName))
  ).trim();
  const email = toText(record.email, auth?.user?.email ?? "");
  const phone = toText(record.phone, auth?.user?.phone ?? "");

  const fromBackend = {
    address: toText(record.address),
    city: toText(record.city),
    state: toText(record.state),
    country: toText(record.country),
    postalCode: toText(record.postal_code),
  };
  const hasBackendAddress = Object.values(fromBackend).some(Boolean);
  const cachedAddress = readCachedAddress(userKey);
  const finalAddress = hasBackendAddress ? fromBackend : cachedAddress ?? fromBackend;
  const backendProfilePictureRaw =
    toText(record.profile_picture) ||
    toText(record.profilePicture) ||
    toText(record.avatar) ||
    toText(record.avatar_url);
  const cachedProfilePicture = readCachedProfilePicture(userKey);
  const finalProfilePicture =
    cachedProfilePicture.fallbackDataUrl ||
    resolveAssetUrl(backendProfilePictureRaw || cachedProfilePicture.profilePicture);

  return {
    id: toText(record.id, toText(record.user_id, auth?.user?.id ?? "")),
    name:
      backendFullName ||
      getDisplayName({
        first_name: firstName,
        last_name: lastName,
        email,
      }) ||
      "My Account",
    email: email || "-",
    phone: phone || "-",
    phoneVerified: toBoolean(
      record.phone_verified ?? record.is_phone_verified,
      Boolean(auth?.user?.phone_verified)
    ),
    role: toText(record.role, auth?.user?.role ?? ""),
    address: finalAddress.address,
    city: finalAddress.city,
    state: finalAddress.state,
    country: finalAddress.country,
    postalCode: finalAddress.postalCode,
    profilePicture: finalProfilePicture,
  };
}

export async function updateCurrentUserProfile(input: UpdateProfileInput): Promise<void> {
  const auth = getAuth();
  const token = auth?.access_token;
  const userKey = getUserCacheKey();

  const payload: Record<string, string> = {
    ...(typeof input.address === "string" ? { address: input.address } : {}),
    ...(typeof input.city === "string" ? { city: input.city } : {}),
    ...(typeof input.state === "string" ? { state: input.state } : {}),
    ...(typeof input.country === "string" ? { country: input.country } : {}),
    ...(typeof input.postalCode === "string" ? { postal_code: input.postalCode } : {}),
    ...(typeof input.phone === "string" ? { phone: input.phone } : {}),
    ...(typeof input.profilePicture === "string"
      ? { profile_picture: input.profilePicture }
      : {}),
  };

  if (auth?.user?.id) {
    payload.user_id = auth.user.id;
  }

  const response = await fetch("/api/user/profile", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const message =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error)
        : `Failed to update profile (${response.status}).`;
    throw new Error(message);
  }

  if (
    typeof input.address === "string" ||
    typeof input.city === "string" ||
    typeof input.state === "string" ||
    typeof input.country === "string" ||
    typeof input.postalCode === "string"
  ) {
    writeCachedAddress(userKey, {
      address: input.address ?? "",
      city: input.city ?? "",
      state: input.state ?? "",
      country: input.country ?? "",
      postalCode: input.postalCode ?? "",
    });
  }

  if (typeof input.profilePicture === "string") {
    const existing = readCachedProfilePicture(userKey);
    writeCachedProfilePicture(
      userKey,
      input.profilePicture,
      existing.fallbackDataUrl
    );
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read selected file."));
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });
}

export async function uploadProfilePicture(file: File): Promise<string> {
  const auth = getAuth();
  const token = auth?.access_token;
  const userKey = getUserCacheKey();
  if (!token) {
    throw new Error("You must be logged in to upload a profile picture.");
  }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", "profile-pictures");

  const response = await fetch("/api/upload/file", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: fd,
  });

  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Profile picture upload failed (${response.status}).`;
    throw new Error(message);
  }

  const record = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const nested =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : {};
  const uploadedUrl =
    toText(record.url) ||
    toText(record.file_url) ||
    toText(record.path) ||
    toText(nested.url) ||
    toText(nested.file_url) ||
    toText(nested.path);

  if (!uploadedUrl) {
    throw new Error("Upload succeeded but no file URL was returned.");
  }

  let fallbackDataUrl = "";
  // Keep a local preview copy so avatar can render even if remote URL is private/unreachable.
  if (file.size <= 2 * 1024 * 1024) {
    try {
      fallbackDataUrl = await fileToDataUrl(file);
    } catch {
      fallbackDataUrl = "";
    }
  }

  const resolvedUrl = resolveAssetUrl(uploadedUrl);
  writeCachedProfilePicture(userKey, resolvedUrl, fallbackDataUrl);
  return resolvedUrl;
}

async function parseApiResponse(response: Response) {
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return payload;
}

export async function resendPhoneVerification(phone: string, email = ""): Promise<void> {
  const response = await fetch("/api/auth/resend-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      email,
      type: "resend_verification",
    }),
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Failed to resend verification (${response.status}).`;
    throw new Error(message);
  }
}

export async function verifyPhoneOtp(
  phone: string,
  otp: string,
  email = ""
): Promise<void> {
  const response = await fetch("/api/auth/verify-phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone,
      email,
      otp,
    }),
  });
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Phone verification failed (${response.status}).`;
    throw new Error(message);
  }
}
