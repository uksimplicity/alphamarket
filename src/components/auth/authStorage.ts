export type AuthUser = {
  id?: string;
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  status?: string;
  email_verified?: boolean;
  phone_verified?: boolean;
};

export type AuthPayload = {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
};

const STORAGE_KEY = "alpha.auth";

export function setAuth(payload: AuthPayload) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

export function getAuth(): AuthPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthPayload) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function getDisplayName(user?: AuthUser | null) {
  if (!user) return "";
  const first = user.first_name?.trim() ?? "";
  const last = user.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  return full || user.email || "Account";
}

